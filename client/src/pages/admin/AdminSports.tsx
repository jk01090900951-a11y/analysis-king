import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Wifi, RefreshCw, Download, Pencil, Trash2, History, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AdminSports() {
  const utils = trpc.useUtils();
  const { data: sports } = trpc.sport.listAdmin.useQuery();
  const { data: leagues } = trpc.sport.allLeagues.useQuery();

  const [leagueDialog, setLeagueDialog] = useState(false);
  const [form, setForm] = useState<any>({ tier: "minor" });

  const [sportEditDialog, setSportEditDialog] = useState(false);
  const [sportEditForm, setSportEditForm] = useState<any>({});
  const [leagueEditDialog, setLeagueEditDialog] = useState(false);
  const [leagueEditForm, setLeagueEditForm] = useState<any>({});

  const [importDialog, setImportDialog] = useState(false);
  const [importSportId, setImportSportId] = useState<number | null>(null);
  const [importCategory, setImportCategory] = useState<"tournament" | "bigleague" | "country">("tournament");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedLeagues, setSelectedLeagues] = useState<Record<string, "major" | "minor">>({});
  const [foundLeagues, setFoundLeagues] = useState<any[]>([]);
  const [searchingLeagues, setSearchingLeagues] = useState(false);
  const [backfillTarget, setBackfillTarget] = useState<any>(null);
  const [backfillSeasonCount, setBackfillSeasonCount] = useState(3);

  // 2026 신규: 자동 동기화 스케줄 (요일+시간)
  const { data: schedule } = trpc.admin.getSyncSchedule.useQuery();
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleDays, setScheduleDays] = useState<Set<string>>(new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]));
  const [scheduleTime, setScheduleTime] = useState("03:00");
  useEffect(() => {
    if (schedule) {
      setScheduleEnabled(schedule.enabled);
      setScheduleDays(new Set(schedule.days));
      setScheduleTime(schedule.time);
    }
  }, [schedule]);
  const updateSchedule = trpc.admin.updateSyncSchedule.useMutation({
    onSuccess: () => toast.success("자동 동기화 스케줄 저장 완료"),
    onError: (e) => toast.error(e.message),
  });
  const runFullSyncNow = trpc.admin.runFullSyncNow.useMutation({
    onSuccess: (r: any) => { toast.success(`수동 전체 동기화 완료 — 리그 ${r.checked}개 확인, 성공 ${r.synced}, 실패 ${r.failed}`); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const dayLabels: [string, string][] = [["mon", "월"], ["tue", "화"], ["wed", "수"], ["thu", "목"], ["fri", "금"], ["sat", "토"], ["sun", "일"]];
  const toggleDay = (d: string) => setScheduleDays((prev) => { const next = new Set(prev); if (next.has(d)) next.delete(d); else next.add(d); return next; });

  const createLeague = trpc.sport.createLeague.useMutation({
    onSuccess: (r: any) => { toast.success(r.reactivated ? "비활성화됐던 리그를 다시 활성화했습니다" : "리그 추가 완료"); utils.sport.allLeagues.invalidate(); setLeagueDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateSport = trpc.sport.update.useMutation({
    onSuccess: () => { toast.success("종목 수정 완료"); utils.sport.listAdmin.invalidate(); setSportEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSport = trpc.sport.deleteSport.useMutation({
    onSuccess: () => { toast.success("종목 삭제 완료"); utils.sport.listAdmin.invalidate(); utils.sport.allLeagues.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateLeague = trpc.sport.updateLeague.useMutation({
    onSuccess: () => { toast.success("리그 수정 완료"); utils.sport.allLeagues.invalidate(); setLeagueEditDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteLeague = trpc.sport.deleteLeague.useMutation({
    onSuccess: () => { toast.success("리그 삭제 완료"); utils.sport.allLeagues.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const testConnection = trpc.sport.testApiSportsConnection.useMutation({
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error(e.message),
  });
  const syncFixtures = trpc.sport.syncFootballFixtures.useMutation({
    onSuccess: (r) => toast.success(`${r.usedSeason} 시즌 · 오늘부터 30일 범위 기준 — 신규 ${r.created}건, 기존 ${r.skipped}건 (총 ${r.total}건 조회)`),
    onError: (e) => toast.error(e.message),
  });
  const syncBaseball = trpc.sport.syncBaseballGames.useMutation({
    onSuccess: (r: any) => toast.success(`${r.usedSeason} 시즌 기준 — 신규 ${r.created}건, 기존 ${r.skipped}건 (총 ${r.total}건 조회)`),
    onError: (e) => toast.error(e.message),
  });
  const backfillSeasons = trpc.sport.backfillSeasons.useMutation({
    onSuccess: (r: any) => {
      const detail = Object.entries(r.perSeason).map(([s, c]) => `${s}시즌 ${c}건`).join(", ");
      toast.success(`백필 완료 — 신규 ${r.created}건, 기존 ${r.skipped}건, 실패 ${r.failed}건 (${detail})`, { duration: 8000 });
      utils.sport.allLeagues.invalidate();
      setBackfillTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const sportNameOf = (sportId: number) => (sports ?? []).find((s: any) => s.id === sportId)?.name;
  const syncLeague = (l: any) => {
    const sn = sportNameOf(l.sportId);
    if (sn === "축구") syncFixtures.mutate({ leagueId: l.id });
    else if (sn === "야구") syncBaseball.mutate({ leagueId: l.id });
    else toast.error(`${sn} 종목은 아직 경기 동기화 기능이 준비되지 않았습니다.`);
  };

  const importSport = (sports ?? []).find((s: any) => s.id === importSportId);
  const { data: countries, isLoading: countriesLoading } = trpc.sport.countries.useQuery(
    { sportName: importSport?.name ?? "" },
    { enabled: !!importSport }
  );

  // 선택한 국가들의 리그를 한 번에 조회 (병렬 요청 후 합쳐서 하나의 목록으로 표시)
  const searchSelectedCountries = async () => {
    if (!importSport || selectedCountries.size === 0) return;
    setSearchingLeagues(true);
    try {
      const results = await Promise.all(
        Array.from(selectedCountries).map((country) =>
          utils.client.sport.searchLeagues.query({ sportName: importSport.name, country })
        )
      );
      setFoundLeagues(results.flat());
    } catch (e: any) {
      toast.error(e?.message ?? "리그 검색 실패");
    } finally {
      setSearchingLeagues(false);
    }
  };

  // 2026 신규: [대회] — 월드컵/챔피언스리그/유로파리그 등 국가대항전은 API-Sports에서 country="World"로 분류됨
  const searchTournaments = async () => {
    if (!importSport) return;
    setSearchingLeagues(true);
    try {
      const results = await utils.client.sport.searchLeagues.query({ sportName: importSport.name, country: "World" });
      setFoundLeagues(results);
    } catch (e: any) {
      toast.error(e?.message ?? "대회 검색 실패");
    } finally {
      setSearchingLeagues(false);
    }
  };

  // 2026 신규: [빅리그] — 인기 축구 리그가 있는 나라들을 미리 정해두고 한 번에 검색 (실제 빅리그 이름은 목록에서 직접 체크)
  const BIG_LEAGUE_COUNTRIES = ["Germany", "Spain", "Italy", "England", "France", "Korea-Republic"];
  const searchBigLeagues = async () => {
    if (!importSport) return;
    setSearchingLeagues(true);
    try {
      const results = await Promise.all(
        BIG_LEAGUE_COUNTRIES.map((country) => utils.client.sport.searchLeagues.query({ sportName: importSport.name, country }))
      );
      setFoundLeagues(results.flat());
    } catch (e: any) {
      toast.error(e?.message ?? "빅리그 검색 실패");
    } finally {
      setSearchingLeagues(false);
    }
  };

  const toggleCountry = (name: string, checked: boolean) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name); else next.delete(name);
      return next;
    });
  };
  const allCountriesSelected = (countries ?? []).length > 0 && (countries ?? []).every((c: any) => selectedCountries.has(c.name));
  const toggleAllCountries = () => {
    if (allCountriesSelected) setSelectedCountries(new Set());
    else setSelectedCountries(new Set((countries ?? []).map((c: any) => c.name)));
  };

  const bulkImport = trpc.sport.bulkImportLeagues.useMutation({
    onSuccess: (r: any) => {
      const parts = [`신규 ${r.created}건`];
      if (r.reactivated) parts.push(`재활성화 ${r.reactivated}건`);
      parts.push(`기존 ${r.skipped}건`);
      toast.success(`가져오기 완료 — ${parts.join(", ")}`);
      utils.sport.allLeagues.invalidate();
      setSelectedLeagues({});
      setImportDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleLeague = (id: string, checked: boolean) => {
    setSelectedLeagues((prev) => {
      const next = { ...prev };
      if (checked) next[id] = "minor";
      else delete next[id];
      return next;
    });
  };
  const allLeaguesSelected = foundLeagues.length > 0 && foundLeagues.every((l: any) => !!selectedLeagues[l.externalLeagueId]);
  const toggleAllLeagues = () => {
    if (allLeaguesSelected) setSelectedLeagues({});
    else {
      const next: Record<string, "major" | "minor"> = {};
      for (const l of foundLeagues) next[l.externalLeagueId] = selectedLeagues[l.externalLeagueId] ?? "minor";
      setSelectedLeagues(next);
    }
  };

  const submitImport = () => {
    if (!importSportId || Object.keys(selectedLeagues).length === 0) return;
    const items = foundLeagues
      .filter((l: any) => selectedLeagues[l.externalLeagueId])
      .map((l: any) => ({ externalLeagueId: l.externalLeagueId, name: l.name, country: l.country, logoUrl: l.logoUrl, tier: selectedLeagues[l.externalLeagueId] }));
    bulkImport.mutate({ sportId: importSportId, items });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">종목 · 리그 관리</h1>
        <div className="flex gap-2">
          <Select onValueChange={(v) => testConnection.mutate({ sportName: v })}>
            <SelectTrigger className="w-40 h-9 text-sm"><Wifi className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="API 연결 테스트" /></SelectTrigger>
            <SelectContent>{(sports ?? []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.icon} {s.name} 테스트</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => setImportDialog(true)}><Download className="w-4 h-4 mr-1" />리그 가져오기</Button>
          <Button size="sm" variant="outline" onClick={() => setLeagueDialog(true)}><Plus className="w-4 h-4 mr-1" />리그 직접 추가</Button>
        </div>
      </div>

      {/* 2026 신규: 경기 자동/수동 동기화 — 항상 둘 다 눈에 보이게 */}
      <div className="mb-8 p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">경기 자동 동기화</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${scheduleEnabled ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
              {scheduleEnabled ? "사용중" : "꺼짐"}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => runFullSyncNow.mutate()} disabled={runFullSyncNow.isPending} className="border-primary/40">
            <Zap className="w-4 h-4 mr-1" />{runFullSyncNow.isPending ? "동기화 중..." : "지금 수동으로 전체 동기화"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={scheduleEnabled} onCheckedChange={(c) => setScheduleEnabled(!!c)} />
            자동 동기화 사용
          </label>
          <div className="flex items-center gap-1.5">
            {dayLabels.map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                className={`w-8 h-8 rounded-lg text-xs font-bold ${scheduleDays.has(key) ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">시간</span>
            <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-28 h-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => updateSchedule.mutate({ enabled: scheduleEnabled, days: Array.from(scheduleDays), time: scheduleTime })} disabled={updateSchedule.isPending}>
            저장
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">체크한 요일의 지정 시간에 등록된 모든 리그를 자동으로 동기화합니다. 예: 월/수/금 + 00:00 → 매주 월·수·금 자정에 실행. 언제든 위 "지금 수동으로 전체 동기화" 버튼으로 즉시 실행할 수도 있습니다.</p>
      </div>

      <h2 className="font-bold mb-2 text-sm text-muted-foreground">종목 ({sports?.length ?? 0}) — 종목 추가는 개발자에게 요청하시면 SPORT_BASE 설정 한 줄로 확장됩니다</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(sports ?? []).map((s: any) => (
          <div key={s.id} className="p-3 rounded-xl bg-card border border-border text-center relative group">
            <div className="text-2xl">{s.icon}</div>
            <p className="text-sm font-medium mt-1">{s.name}</p>
            <div className="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setSportEditForm(s); setSportEditDialog(true); }}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => { if (confirm(`"${s.name}" 종목을 삭제하시겠습니까? 소속 리그도 함께 안 보이게 됩니다.`)) deleteSport.mutate({ id: s.id }); }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-bold mb-2 text-sm text-muted-foreground">리그 ({leagues?.length ?? 0}) — 리그마다 분석가 10명(주요) 또는 4명(일반)을 직접 지정합니다</h2>
      <div className="space-y-2">
        {(leagues ?? []).map((l: any) => (
          <div key={l.id} className="p-3 rounded-lg bg-card border border-border flex justify-between items-center text-sm">
            <span>{l.name} <span className="text-xs text-muted-foreground">({l.country}) {l.externalLeagueId ? `· API ID: ${l.externalLeagueId}` : ""}</span></span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${l.tier === "major" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{l.tier === "major" ? "분석가 10명" : "분석가 4명"}</span>
              {l.externalLeagueId && (
                <Button size="sm" variant="ghost" onClick={() => syncLeague(l)} disabled={syncFixtures.isPending || syncBaseball.isPending}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />경기 동기화
                </Button>
              )}
              {l.externalLeagueId && (
                <Button size="sm" variant="ghost" onClick={() => setBackfillTarget(l)}>
                  <History className="w-3.5 h-3.5 mr-1" />과거 시즌 채우기
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setLeagueEditForm(l); setLeagueEditDialog(true); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`"${l.name}" 리그를 삭제하시겠습니까?`)) deleteLeague.mutate({ id: l.id }); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 나라별 리그 대량 가져오기 */}
      <Dialog open={importDialog} onOpenChange={(o) => { setImportDialog(o); if (!o) { setSelectedCountries(new Set()); setFoundLeagues([]); setSelectedLeagues({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>리그 가져오기 (대회 · 빅리그 · 나라별)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={importSportId ? String(importSportId) : undefined} onValueChange={(v) => { setImportSportId(Number(v)); setSelectedCountries(new Set()); setFoundLeagues([]); setSelectedLeagues({}); }}>
              <SelectTrigger><SelectValue placeholder="① 종목 선택" /></SelectTrigger>
              <SelectContent>{(sports ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>

            {importSportId && (
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => { setImportCategory("tournament"); setFoundLeagues([]); setSelectedLeagues({}); }} className={`py-2 rounded-lg text-xs font-bold ${importCategory === "tournament" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>대회</button>
                <button onClick={() => { setImportCategory("bigleague"); setFoundLeagues([]); setSelectedLeagues({}); }} className={`py-2 rounded-lg text-xs font-bold ${importCategory === "bigleague" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>빅리그</button>
                <button onClick={() => { setImportCategory("country"); setFoundLeagues([]); setSelectedLeagues({}); }} className={`py-2 rounded-lg text-xs font-bold ${importCategory === "country" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>나라별</button>
              </div>
            )}

            {importSportId && importCategory === "tournament" && (
              <div className="border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">월드컵·아시안컵·챔피언스리그·유로파리그·A매치 등 국가/대륙 단위 대회를 한 번에 불러옵니다.</p>
                <Button size="sm" className="w-full" onClick={searchTournaments} disabled={searchingLeagues}>
                  {searchingLeagues ? "대회 목록 검색 중..." : "대회 목록 검색"}
                </Button>
              </div>
            )}

            {importSportId && importCategory === "bigleague" && (
              <div className="border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">분데스리가·라리가·세리에A·프리미어리그·리그1·K리그 등 인기 리그가 있는 국가들을 한 번에 검색합니다. 검색 후 목록에서 원하는 리그만 체크하세요.</p>
                <Button size="sm" className="w-full" onClick={searchBigLeagues} disabled={searchingLeagues}>
                  {searchingLeagues ? "빅리그 검색 중..." : "빅리그 국가 검색"}
                </Button>
              </div>
            )}

            {importSportId && importCategory === "country" && (
              <div className="border border-border rounded-lg p-2">
                <div className="flex items-center justify-between px-1 py-1.5 border-b border-border/50 mb-1">
                  <p className="text-xs text-muted-foreground">국가 선택 (여러 개 가능) — {selectedCountries.size}개 선택됨</p>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={allCountriesSelected} onCheckedChange={toggleAllCountries} />전체 선택
                  </label>
                </div>
                {countriesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">국가 목록 불러오는 중...</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {(countries ?? []).map((c: any) => (
                      <label key={c.name} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent/30 cursor-pointer text-sm">
                        <Checkbox checked={selectedCountries.has(c.name)} onCheckedChange={(ch) => toggleCountry(c.name, !!ch)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
                {selectedCountries.size > 0 && (
                  <Button size="sm" className="w-full mt-2" onClick={searchSelectedCountries} disabled={searchingLeagues}>
                    {searchingLeagues ? "리그 검색 중..." : `선택한 ${selectedCountries.size}개국 리그 검색`}
                  </Button>
                )}
              </div>
            )}

            {foundLeagues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">② 등록할 리그를 선택하세요 (1부/2부/컵대회 등, 총 {foundLeagues.length}개 조회됨)</p>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                    <Checkbox checked={allLeaguesSelected} onCheckedChange={toggleAllLeagues} />전체 선택
                  </label>
                </div>
                {Object.keys(selectedLeagues).length > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-accent/10 rounded-lg p-2">
                    <span className="text-muted-foreground shrink-0">선택한 {Object.keys(selectedLeagues).length}개를 일괄로</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedLeagues((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, "major"])))}>
                      전부 분석가 10명
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedLeagues((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, "minor"])))}>
                      전부 분석가 4명
                    </Button>
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {foundLeagues.map((l: any) => (
                    <div key={l.externalLeagueId} className="flex items-center gap-2 p-2 rounded-lg bg-accent/20 min-w-0">
                      <Checkbox checked={!!selectedLeagues[l.externalLeagueId]} onCheckedChange={(c) => toggleLeague(l.externalLeagueId, !!c)} className="shrink-0" />
                      <span className="flex-1 min-w-0 text-sm truncate">{l.name} <span className="text-xs text-muted-foreground">({l.country}{l.type ? ` · ${l.type}` : ""})</span></span>
                      {selectedLeagues[l.externalLeagueId] && (
                        <Select value={selectedLeagues[l.externalLeagueId]} onValueChange={(v) => setSelectedLeagues((p) => ({ ...p, [l.externalLeagueId]: v as "major" | "minor" }))}>
                          <SelectTrigger className="w-24 h-7 text-xs shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="major">10명</SelectItem>
                            <SelectItem value="minor">4명</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {Object.keys(selectedLeagues).length > 0 && (
            <Button className="w-full mt-3" onClick={submitImport} disabled={bulkImport.isPending}>
              {bulkImport.isPending ? "가져오는 중..." : `선택한 ${Object.keys(selectedLeagues).length}개 리그 등록`}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* 리그 직접 추가 (수동, 예외적인 경우용) */}
      <Dialog open={leagueDialog} onOpenChange={setLeagueDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>리그 직접 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="리그명" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.sportId ? String(form.sportId) : undefined} onValueChange={(v) => setForm({ ...form, sportId: Number(v) })}>
              <SelectTrigger><SelectValue placeholder="종목 선택" /></SelectTrigger>
              <SelectContent>{(sports ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="major">분석가 10명 배정</SelectItem>
                <SelectItem value="minor">분석가 4명 배정</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="국가" onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <Input placeholder="API-Sports 리그ID (선택사항)" onChange={(e) => setForm({ ...form, externalLeagueId: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => createLeague.mutate(form)}>추가</Button>
        </DialogContent>
      </Dialog>

      {/* 종목 수정 */}
      <Dialog open={sportEditDialog} onOpenChange={setSportEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>종목 수정</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="종목명" value={sportEditForm.name ?? ""} onChange={(e) => setSportEditForm({ ...sportEditForm, name: e.target.value })} />
            <Input placeholder="아이콘(이모지)" value={sportEditForm.icon ?? ""} onChange={(e) => setSportEditForm({ ...sportEditForm, icon: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => updateSport.mutate({ id: sportEditForm.id, name: sportEditForm.name, icon: sportEditForm.icon })}>저장</Button>
        </DialogContent>
      </Dialog>

      {/* 리그 수정 */}
      <Dialog open={leagueEditDialog} onOpenChange={setLeagueEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>리그 수정</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="리그명" value={leagueEditForm.name ?? ""} onChange={(e) => setLeagueEditForm({ ...leagueEditForm, name: e.target.value })} />
            <Input placeholder="국가" value={leagueEditForm.country ?? ""} onChange={(e) => setLeagueEditForm({ ...leagueEditForm, country: e.target.value })} />
            <Select value={leagueEditForm.tier ?? "minor"} onValueChange={(v) => setLeagueEditForm({ ...leagueEditForm, tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="major">분석가 10명 배정</SelectItem>
                <SelectItem value="minor">분석가 4명 배정</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="API-Sports 리그ID" value={leagueEditForm.externalLeagueId ?? ""} onChange={(e) => setLeagueEditForm({ ...leagueEditForm, externalLeagueId: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => updateLeague.mutate({ id: leagueEditForm.id, name: leagueEditForm.name, country: leagueEditForm.country, tier: leagueEditForm.tier, externalLeagueId: leagueEditForm.externalLeagueId })}>저장</Button>
        </DialogContent>
      </Dialog>

      {/* 과거 시즌 초기 백필 */}
      <Dialog open={!!backfillTarget} onOpenChange={(o) => !o && setBackfillTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>과거 시즌 채우기 — {backfillTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              이 리그의 최근 몇 시즌을 한 번에 몰아서 가져올지 선택하세요. 리그 전체(모든 팀)의 경기가 한꺼번에 쌓입니다. 시즌이 많을수록 API 요청도 늘어납니다.
            </p>
            <Select value={String(backfillSeasonCount)} onValueChange={(v) => setBackfillSeasonCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">최근 1시즌</SelectItem>
                <SelectItem value="2">최근 2시즌</SelectItem>
                <SelectItem value="3">최근 3시즌 (권장)</SelectItem>
                <SelectItem value="4">최근 4시즌</SelectItem>
                <SelectItem value="5">최근 5시즌</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={backfillSeasons.isPending}
              onClick={() => {
                const thisYear = new Date().getFullYear();
                const seasons = Array.from({ length: backfillSeasonCount }, (_, i) => thisYear - i);
                backfillSeasons.mutate({ leagueId: backfillTarget.id, seasons });
              }}
            >
              {backfillSeasons.isPending ? "채우는 중... (시간이 걸릴 수 있습니다)" : "지금 채우기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
