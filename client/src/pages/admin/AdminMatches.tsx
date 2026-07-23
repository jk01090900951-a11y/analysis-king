import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Zap, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminMatches() {
  const utils = trpc.useUtils();
  const { data: matches, isLoading } = trpc.match.list.useQuery({ status: "scheduled", limit: 500 });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hideDone, setHideDone] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);

  const genPicksMutation = trpc.bot.generatePicks.useMutation();
  const genAnalysisMutation = trpc.analysis.generate.useMutation();

  const visibleMatches = useMemo(() => {
    const list = matches ?? [];
    return hideDone ? list.filter((m: any) => !m.hasAnalysis) : list;
  }, [matches, hideDone]);

  const allSelected = visibleMatches.length > 0 && visibleMatches.every((m: any) => selected.has(m.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleMatches.map((m: any) => m.id)));
  };
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // 대량 처리는 병렬로 쏘지 않고 하나씩 순서대로 처리합니다 (API 요청 폭주 방지 + 진행률 표시 목적)
  const runBulk = async (label: string, ids: number[], fn: (id: number) => Promise<unknown>) => {
    setProgress({ label, done: 0, total: ids.length });
    let success = 0, failed = 0;
    let lastError = "";
    for (let i = 0; i < ids.length; i++) {
      try {
        await fn(ids[i]!);
        success++;
      } catch (e: any) {
        failed++;
        lastError = e?.message ?? String(e);
      }
      setProgress({ label, done: i + 1, total: ids.length });
    }
    setProgress(null);
    utils.match.list.invalidate();
    if (failed > 0 && success === 0) {
      toast.error(`${label} 실패 (${failed}건) — ${lastError}`, { duration: 10000 });
    } else if (failed > 0) {
      toast.success(`${label} 완료 — 성공 ${success}건, 실패 ${failed}건 (마지막 오류: ${lastError})`, { duration: 10000 });
    } else {
      toast.success(`${label} 완료 — 성공 ${success}건`);
    }
  };

  const bulkGenPicks = () => runBulk("픽 일괄 생성", Array.from(selected), (id) => genPicksMutation.mutateAsync({ matchId: id }));
  const bulkGenAnalysis = () => runBulk("분석글 일괄 생성", Array.from(selected), (id) => genAnalysisMutation.mutateAsync({ matchId: id }));

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">경기 등록 · AI 콘텐츠 생성</h1>
      <p className="text-sm text-muted-foreground mb-4">경기 일정/결과는 API-Sports에서 자동 수신됩니다. 여러 경기를 체크한 뒤 아래 버튼으로 한 번에 생성할 수 있습니다.</p>

      {/* 상단 툴바 */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-card border border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          <span className="text-sm text-muted-foreground">
            {selected.size > 0 ? `${selected.size}개 선택됨` : "전체 선택"} (표시 중 {visibleMatches.length}건)
          </span>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground ml-4 cursor-pointer">
            <Checkbox checked={hideDone} onCheckedChange={(c) => setHideDone(!!c)} />
            분석글 없는 경기만 보기
          </label>
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
          <div className="flex justify-between text-sm mb-1.5">
            <span>{progress.label} 진행 중... ({progress.done}/{progress.total})</span>
            <span>{Math.round((progress.done / progress.total) * 100)}%</span>
          </div>
          <Progress value={(progress.done / progress.total) * 100} />
          <p className="text-xs text-muted-foreground mt-1.5">창을 닫지 말고 잠시 기다려주세요. 경기 수가 많으면 시간이 걸릴 수 있습니다.</p>
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
              {m.hasAnalysis && <Badge className="text-xs bg-primary/20 text-primary border-primary/30"><CheckCircle2 className="w-3 h-3 mr-1" />분석글완료</Badge>}
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
    </div>
  );
}
