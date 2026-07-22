import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Wifi, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminSports() {
  const utils = trpc.useUtils();
  const { data: sports } = trpc.sport.listAdmin.useQuery();
  const { data: leagues } = trpc.sport.allLeagues.useQuery();
  const [leagueDialog, setLeagueDialog] = useState(false);
  const [form, setForm] = useState<any>({ tier: "minor" });

  const createLeague = trpc.sport.createLeague.useMutation({
    onSuccess: () => { toast.success("리그 추가 완료"); utils.sport.allLeagues.invalidate(); setLeagueDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const testConnection = trpc.sport.testApiSportsConnection.useMutation({
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error(e.message),
  });
  const syncFixtures = trpc.sport.syncFootballFixtures.useMutation({
    onSuccess: (r) => toast.success(`동기화 완료 — 신규 ${r.created}건, 기존 ${r.skipped}건 (총 ${r.total}건 조회)`),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">종목 · 리그 관리</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
            <Wifi className="w-4 h-4 mr-1" />API 연결 테스트
          </Button>
          <Button size="sm" onClick={() => setLeagueDialog(true)}><Plus className="w-4 h-4 mr-1" />리그 추가</Button>
        </div>
      </div>

      <h2 className="font-bold mb-2 text-sm text-muted-foreground">종목 ({sports?.length ?? 0})</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(sports ?? []).map((s: any) => (
          <div key={s.id} className="p-3 rounded-xl bg-card border border-border text-center">
            <div className="text-2xl">{s.icon}</div>
            <p className="text-sm font-medium mt-1">{s.name}</p>
          </div>
        ))}
      </div>

      <h2 className="font-bold mb-2 text-sm text-muted-foreground">리그 ({leagues?.length ?? 0}) — tier: major=빅리그(픽10개) / minor=비인기(픽4개)</h2>
      <p className="text-xs text-muted-foreground mb-3">"API-Sports 리그ID"가 입력된 축구 리그만 동기화 버튼이 활성화됩니다 (예: EPL=39). API-Football 사이트에서 리그별 ID를 확인해 입력하세요.</p>
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
            </div>
          </div>
        ))}
      </div>

      <Dialog open={leagueDialog} onOpenChange={setLeagueDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>리그 추가</DialogTitle></DialogHeader>
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
            <Input placeholder="API-Sports 리그ID (축구만, 선택사항 — 예: 39)" onChange={(e) => setForm({ ...form, externalLeagueId: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => createLeague.mutate(form)}>추가</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

