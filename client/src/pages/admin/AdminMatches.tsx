import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, FileText, CheckCircle2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 30;

export default function AdminMatches() {
  const utils = trpc.useUtils();
  const { data: sports } = trpc.sport.list.useQuery();

  const [sportId, setSportId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("scheduled");
  const [todayOnly, setTodayOnly] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.match.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    sportId: sportId ?? undefined,
    todayOnly,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const matches = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ label: string; done: number; total: number; currentName?: string } | null>(null);
  const [lastFailed, setLastFailed] = useState<{ label: string; ids: number[]; kind: "picks" | "analysis" } | null>(null);

  const genPicksMutation = trpc.bot.generatePicks.useMutation();
  const genAnalysisMutation = trpc.analysis.generate.useMutation();
  const deleteAnalysisMutation = trpc.admin.deleteMatchAnalysis.useMutation();
  const cleanupMutation = trpc.admin.cleanupOldMatches.useMutation({
    onSuccess: (r) => { toast.success(`오래된 데이터 ${r.deleted}건 정리 완료`); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const visibleMatches = hideDone ? matches.filter((m: any) => !m.hasAnalysis) : matches;
  const allSelected = visibleMatches.length > 0 && visibleMatches.every((m: any) => selected.has(m.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleMatches.map((m: any) => m.id)));
  };

  // 페이지네이션과 무관하게, 지금 필터에 걸리는 전체를 한 번에 선택 (300건이든 몇 건이든 한 번에)
  const [selectingAll, setSelectingAll] = useState(false);
  const selectAllAcrossPages = async () => {
    setSelectingAll(true);
    try {
      const ids = await utils.client.match.allIds.query({
        status: statusFilter === "all" ? undefined : statusFilter,
        sportId: sportId ?? undefined,
        todayOnly,
      });
      setSelected(new Set(ids));
      toast.success(`전체 ${ids.length}건 선택 완료`);
    } catch (e: any) {
      toast.error(e?.message ?? "전체 선택 실패");
    } finally {
      setSelectingAll(false);
    }
  };
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const changeFilter = (fn: () => void) => { fn(); setSelected(new Set()); setPage(0); };

  // 대량 처리는 병렬로 쏘지 않고 하나씩 순서대로 처리합니다 (API 요청 폭주 방지 + 진행률 표시 목적)
  const findMatchName = (id: number) => {
    const m = matches.find((mm: any) => mm.id === id);
    return m ? `${m.homeTeam} vs ${m.awayTeam}` : `#${id}`;
  };

  const stopRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 진행 중에 실수로 창을 닫거나 새로고침하면 경고를 띄워서, "중지" 버튼을 먼저 누르도록 유도
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (progress) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [progress]);

  const runBulk = async (label: string, ids: number[], fn: (id: number, signal: AbortSignal) => Promise<unknown>, kind: "picks" | "analysis") => {
    stopRequestedRef.current = false;
    setProgress({ label, done: 0, total: ids.length, currentName: findMatchName(ids[0]!) });
    let success = 0;
    const failedIds: number[] = [];
    let lastError = "";
    let stoppedEarly = false;
    for (let i = 0; i < ids.length; i++) {
      if (stopRequestedRef.current) {
        stoppedEarly = true;
        // 아직 처리 안 한 나머지도 "재시도 대상"에 포함시켜서, 나중에 이어서 할 수 있게 함
        failedIds.push(...ids.slice(i));
        break;
      }
      setProgress({ label, done: i, total: ids.length, currentName: findMatchName(ids[i]!) });
      // 2026 수정: 매 요청마다 새 AbortController를 만들어, "중지" 버튼이 지금 진행 중인 요청 자체도 끊을 수 있게 함
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        await fn(ids[i]!, controller.signal);
        success++;
      } catch (e: any) {
        if (controller.signal.aborted) {
          stoppedEarly = true;
          failedIds.push(...ids.slice(i));
          break;
        }
        failedIds.push(ids[i]!);
        lastError = e?.message ?? String(e);
      }
      setProgress({ label, done: i + 1, total: ids.length, currentName: i + 1 < ids.length ? findMatchName(ids[i + 1]!) : undefined });
    }
    abortControllerRef.current = null;
    setProgress(null);
    utils.match.list.invalidate();
    const failed = failedIds.length;
    if (failed > 0) {
      setLastFailed({ label, ids: failedIds, kind });
    } else {
      setLastFailed(null);
    }
    if (stoppedEarly) {
      toast(`${label} 중지됨 — 성공 ${success}건, 남은 ${failed}건은 "재시도" 버튼으로 이어서 할 수 있습니다.`, { duration: 8000 });
    } else if (failed > 0 && success === 0) {
      toast.error(`${label} 실패 (${failed}건) — ${lastError}`, { duration: 10000 });
    } else if (failed > 0) {
      toast.success(`${label} 완료 — 성공 ${success}건, 실패 ${failed}건 (마지막 오류: ${lastError})`, { duration: 10000 });
    } else {
      toast.success(`${label} 완료 — 성공 ${success}건`);
    }
  };

  // 2026 수정: 진행중인 요청 자체를 즉시 취소 (기존엔 다음 경기로 못 넘어가게만 막아서 "중지"가 안 먹는 것처럼 보였음)
  const requestStop = () => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
  };

  const bulkGenPicks = () => runBulk("픽 일괄 생성", Array.from(selected), (id, signal) => utils.client.bot.generatePicks.mutate({ matchId: id }, { signal }), "picks");
  const bulkGenAnalysis = () => runBulk("분석글 일괄 생성", Array.from(selected), (id, signal) => utils.client.analysis.generate.mutate({ matchId: id }, { signal }), "analysis");
  const retryFailed = () => {
    if (!lastFailed) return;
    const fn = lastFailed.kind === "picks"
      ? (id: number, signal: AbortSignal) => utils.client.bot.generatePicks.mutate({ matchId: id }, { signal })
      : (id: number, signal: AbortSignal) => utils.client.analysis.generate.mutate({ matchId: id }, { signal });
    runBulk(`${lastFailed.label} (재시도)`, lastFailed.ids, fn, lastFailed.kind);
  };

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">경기 등록 · AI 콘텐츠 생성</h1>
      <p className="text-sm text-muted-foreground mb-4">경기 일정/결과는 API-Sports에서 자동 수신됩니다. 여러 경기를 체크한 뒤 아래 버튼으로 한 번에 생성할 수 있습니다.</p>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl bg-card border border-border">
        <Select value={sportId ? String(sportId) : "all"} onValueChange={(v) => changeFilter(() => setSportId(v === "all" ? null : Number(v)))}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="전체 종목" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 종목</SelectItem>
            {(sports ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.icon} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => changeFilter(() => setStatusFilter(v))}>
          <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">예정</SelectItem>
            <SelectItem value="live">진행중</SelectItem>
            <SelectItem value="finished">종료</SelectItem>
            <SelectItem value="all">전체 상태</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer px-2">
          <Checkbox checked={todayOnly} onCheckedChange={(c) => changeFilter(() => setTodayOnly(!!c))} />
          오늘 경기만
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer px-2">
          <Checkbox checked={hideDone} onCheckedChange={(c) => setHideDone(!!c)} />
          분석글 없는 것만
        </label>
        <Button
          size="sm" variant="outline" className="ml-auto text-destructive border-destructive/30"
          onClick={() => { if (confirm("2025-01-01 이전 데이터를 전부 삭제합니다 (파이프라인 테스트용 과거 데이터 정리). 계속할까요?")) cleanupMutation.mutate({ beforeDate: "2025-01-01" }); }}
          disabled={cleanupMutation.isPending}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />2024 이전 테스트 데이터 정리
        </Button>
      </div>

      {/* 선택/일괄생성 툴바 */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-card border border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          <span className="text-sm text-muted-foreground">
            {selected.size > 0 ? `${selected.size}개 선택됨` : "이 페이지 선택"} (이 페이지 {visibleMatches.length}건 / 전체 {total}건)
          </span>
          {total > visibleMatches.length && (
            <Button size="sm" variant="ghost" className="text-xs h-7 text-primary" onClick={selectAllAcrossPages} disabled={selectingAll}>
              {selectingAll ? "불러오는 중..." : `전체 ${total}건 모두 선택 (페이지 무관)`}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={bulkGenPicks} disabled={selected.size === 0 || !!progress}>
            <Zap className="w-4 h-4 mr-1" />선택 {selected.size}건 픽 일괄생성
          </Button>
          <Button size="sm" onClick={bulkGenAnalysis} disabled={selected.size === 0 || !!progress}>
            <FileText className="w-4 h-4 mr-1" />선택 {selected.size}건 분석글 일괄생성
          </Button>
        </div>
      </div>

      {/* 진행률 표시 */}
      {progress && (
        <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/30">
          <div className="flex justify-between items-center text-sm mb-1.5">
            <span>{progress.label} 진행 중... ({progress.done}/{progress.total})</span>
            <div className="flex items-center gap-2">
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              <Button size="sm" variant="outline" className="h-6 text-xs border-destructive/40 text-destructive" onClick={requestStop}>
                중지
              </Button>
            </div>
          </div>
          <Progress value={(progress.done / progress.total) * 100} />
          {progress.currentName && (
            <p className="text-xs text-primary mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />지금 처리 중: {progress.currentName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">창을 닫으면 여기서부터 이어지지 않고 완전히 중단됩니다. 나가시기 전엔 "중지"를 눌러 안전하게 멈춰주세요.</p>
        </div>
      )}

      {!progress && lastFailed && lastFailed.ids.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-3">
          <p className="text-xs text-destructive">
            지난 {lastFailed.label}에서 {lastFailed.ids.length}건 실패했습니다 (예: 크레딧 소진). 충전 등 조치 후 실패한 것만 다시 시도할 수 있습니다.
          </p>
          <Button size="sm" variant="outline" className="border-destructive/40 text-destructive shrink-0" onClick={retryFailed}>
            실패한 {lastFailed.ids.length}건 재시도
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">로딩 중...</div>
        ) : visibleMatches.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">표시할 경기가 없습니다.</div>
        ) : (
          visibleMatches.map((m: any) => (
            <div key={m.id} className={`p-3 rounded-xl bg-card border flex items-center gap-3 text-sm ${selected.has(m.id) ? "border-primary/50" : "border-border"}`}>
              <Checkbox checked={selected.has(m.id)} onCheckedChange={(c) => toggleOne(m.id, !!c)} />
              <span className="text-lg">{m.sportIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{m.homeTeam} vs {m.awayTeam}</div>
                <div className="text-xs text-muted-foreground">{m.leagueName} · {new Date(m.matchDate).toLocaleString("ko-KR")}</div>
              </div>
              {m.hasPicks && <Badge variant="outline" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />픽완료</Badge>}
              {m.hasAnalysis && (
                <Badge className={`text-xs ${m.analysisCount >= m.expectedAnalysisCount ? "bg-primary/20 text-primary border-primary/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {m.analysisCount >= m.expectedAnalysisCount ? "분석글완료" : `분석글 ${m.analysisCount}/${m.expectedAnalysisCount}명`}
                </Badge>
              )}
              {m.hasAnalysis && (
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                  title="이 경기 분석글 삭제 후 재생성"
                  onClick={() => {
                    if (confirm(`"${m.homeTeam} vs ${m.awayTeam}"의 분석글·픽을 삭제합니다. 경기 자체와 상세데이터는 유지됩니다. 계속할까요?`)) {
                      deleteAnalysisMutation.mutate({ matchId: m.id }, {
                        onSuccess: (r: any) => { toast.success(`분석글 ${r.deletedAnalyses}건, 픽 ${r.deletedPicks}건 삭제 완료`); utils.match.list.invalidate(); },
                        onError: (e) => toast.error(e.message),
                      });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => genPicksMutation.mutate({ matchId: m.id }, { onSuccess: () => { toast.success("픽 생성 완료"); utils.match.list.invalidate(); } })}>
                <Zap className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => genAnalysisMutation.mutate({ matchId: m.id }, { onSuccess: (r: any) => { toast.success(`분석글 생성 완료 (성공 ${r.successCount}건${r.failCount ? `, 실패 ${r.failCount}건` : ""})`); utils.match.list.invalidate(); } })}>
                <FileText className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages} 페이지</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
