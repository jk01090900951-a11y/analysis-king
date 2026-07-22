import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">종목 · 리그 관리</h1>
        <Button size="sm" onClick={() => setLeagueDialog(true)}><Plus className="w-4 h-4 mr-1" />리그 추가</Button>
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
      <div className="space-y-2">
        {(leagues ?? []).map((l: any) => (
          <div key={l.id} className="p-3 rounded-lg bg-card border border-border flex justify-between items-center text-sm">
            <span>{l.name} <span className="text-xs text-muted-foreground">({l.country})</span></span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${l.tier === "major" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{l.tier}</span>
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
          </div>
          <Button className="w-full mt-3" onClick={() => createLeague.mutate(form)}>추가</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
