import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Wifi, RefreshCw, Download, Pencil, Trash2 } from "lucide-react";
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
  const [importCountry, setImportCountry] = useState<string | null>(null);
  const [selectedLeagues, setSelectedLeagues] = useState<Record<string, "major" | "minor">>({});

  const createLeague = trpc.sport.createLeague.useMutation({
    onSuccess: () => { toast.success("리그 추가 완료"); utils.sport.allLeagues.invalidate(); setLeagueDialog(false); },
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

  const importSport = (sports ?? []).find((s: any) => s.id === importSportId);
  const { data: countries, isLoading: countriesLoading } = trpc.sport.countries.useQuery(
    { sportName: importSport?.name ?? "" },
    { enabled: !!importSport }
  );
  const { data: foundLeagues, isLoading: leaguesLoading } = trpc.sport.searchLeagues.useQuery(
    { sportName: importSport?.name ?? "", country: importCountry ?? "" },
    { enabled: !!importSport && !!importCountry }
  );
  const bulkImport = trpc.sport.bulkImportLeagues.useMutation({
    onSuccess: (r) => {
      toast.success(`가져오기 완료 — 신규 ${r.created}건, 기존 ${r.skipped}건`);
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

  const submitImport = () => {
    if (!importSportId || Object.keys(selectedLeagues).length === 0) return;
    const items = (foundLeagues ?? [])
      .filter((l: any) => selectedLeagues[l.externalLeagueId])
      .map((l: any) => ({ externalLeagueId: l.externalLeagueId, name: l.name, country: l.country, logoUrl: l.logoUrl, tier: selectedLeagues[l.externalLeagueId] }));
    bulkImport.mutate({ sportId: importSportId, items });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">종목 · 리그 관리</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
            <Wifi className="w-4 h-4 mr-1" />API 연결 테스트
          </Button>
          <Button size="sm" onClick={() => setImportDialog(true)}><Download className="w-4 h-4 mr-1" />나라별 리그 가져오기</Button>
          <Button size="sm" variant="outline" onClick={() => setLeagueDialog(true)}><Plus className="w-4 h-4 mr-1" />리그 직접 추가</Button>
        </div>
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

      <h2 className="font-bold mb-2 text-sm text-muted-foreground">리그 ({leagues?.length ?? 0}) — tier: major=빅리그(픽10개) / minor=비인기(픽4개)</h2>
      <div className="space-y-2">
        {(leagues ?? []).map((l: any) => (
          <div key={l.id} className="p-3 rounded-lg bg-card border border-border flex justify-between items-center text-sm">
            <span>{l.name} <span className="text-xs text-muted-foreground">({l.country}) {l.externalLeagueId ? `· API ID: ${l.externalLeagueId}` : ""}</span></span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${l.tier === "major" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{l.tier}</span>
              {l.externalLeagueId && (
                <Button size="sm" variant="ghost" onClick={() => syncFixtures.mutate({ leagueId: l.id })} disabled={syncFixtures.isPending}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />경기 동기화
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
      <Dialog open={importDialog} onOpenChange={(o) => { setImportDialog(o); if (!o) { setImportCountry(null); setSelectedLeagues({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>나라별 리그 가져오기</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={importSportId ? String(importSportId) : undefined} onValueChange={(v) => { setImportSportId(Number(v)); setImportCountry(null); setSelectedLeagues({}); }}>
              <SelectTrigger><SelectValue placeholder="① 종목 선택" /></SelectTrigger>
              <SelectContent>{(sports ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>

            {importSportId && (
              <Select value={importCountry ?? undefined} onValueChange={(v) => { setImportCountry(v); setSelectedLeagues({}); }} disabled={countriesLoading}>
                <SelectTrigger><SelectValue placeholder={countriesLoading ? "국가 목록 불러오는 중..." : "② 국가 선택"} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {(countries ?? []).map((c: any) => <SelectItem key={c.name} value={c.name}>{c.flag ? `${c.name}` : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {importCountry && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">③ 등록할 리그를 선택하세요 (1부/2부/컵대회 등)</p>
                {leaguesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-6">리그 목록 불러오는 중...</p>
                ) : (foundLeagues ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">이 국가에서 조회되는 리그가 없습니다.</p>
                ) : (
                  (foundLeagues ?? []).map((l: any) => (
                    <div key={l.externalLeagueId} className="flex items-center gap-3 p-2 rounded-lg bg-accent/20">
                      <Checkbox checked={!!selectedLeagues[l.externalLeagueId]} onCheckedChange={(c) => toggleLeague(l.externalLeagueId, !!c)} />
                      <span className="flex-1 text-sm">{l.name} {l.type && <span className="text-xs text-muted-foreground">({l.type})</span>}</span>
                      {selectedLeagues[l.externalLeagueId] && (
                        <Select value={selectedLeagues[l.externalLeagueId]} onValueChange={(v) => setSelectedLeagues((p) => ({ ...p, [l.externalLeagueId]: v as "major" | "minor" }))}>
                          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="major">빅리그</SelectItem>
                            <SelectItem value="minor">비인기</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))
                )}
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
                <SelectItem value="major">major (빅리그, 픽 10개)</SelectItem>
                <SelectItem value="minor">minor (비인기, 픽 4개)</SelectItem>
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
                <SelectItem value="major">major (빅리그, 픽 10개)</SelectItem>
                <SelectItem value="minor">minor (비인기, 픽 4개)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="API-Sports 리그ID" value={leagueEditForm.externalLeagueId ?? ""} onChange={(e) => setLeagueEditForm({ ...leagueEditForm, externalLeagueId: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => updateLeague.mutate({ id: leagueEditForm.id, name: leagueEditForm.name, country: leagueEditForm.country, tier: leagueEditForm.tier, externalLeagueId: leagueEditForm.externalLeagueId })}>저장</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
