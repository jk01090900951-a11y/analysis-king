import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, AlertTriangle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const settleStatusInfo: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "정산 대기", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: RefreshCw },
  settled: { label: "정산 완료", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  error: { label: "오류 (수동확인 필요)", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
};

export default function AdminSettle() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.match.list.useQuery({ status: "finished", limit: 100 });
  const matches = data?.rows;
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [scoreForm, setScoreForm] = useState<{ homeScore?: number; awayScore?: number }>({});

  // 경기 목록/결과는 API-Sports 자동 폴링으로 수신됨 (기존 라이브스코어 파이프라인과 동일).
  // 이 화면은 "자동 정산 상태 모니터링 + 실패 시 수동 개입"이 핵심 역할.
  const autoSyncStatus = trpc.admin.apiSyncStatus.useQuery(undefined, { refetchInterval: 30000 });

  const runSettlement = trpc.admin.settleMatch.useMutation({
    onSuccess: () => { toast.success("정산 실행 완료 (분석가 승률/순위 갱신)"); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const manualScoreUpdate = trpc.match.update.useMutation({
    onSuccess: () => { toast.success("스코어 수동 수정 완료"); utils.match.list.invalidate(); setEditDialog({ open: false }); },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (m: any) => {
    setScoreForm({ homeScore: m.homeScore, awayScore: m.awayScore });
    setEditDialog({ open: true, data: m });
  };

  const refreshLive = trpc.admin.refreshLiveMatches.useMutation({
    onSuccess: (r) => { toast.success(`경기상태 확인 ${r.checked}건 중 ${r.updated}건 갱신됨`); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">결과 입력 · 정산</h1>
          <p className="text-sm text-muted-foreground mt-1">경기 일정·결과는 API-Sports에서 자동 수신됩니다. 이 화면은 정산 상태 확인 및 오류 시 수동 개입용입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => refreshLive.mutate()} disabled={refreshLive.isPending}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshLive.isPending ? "animate-spin" : ""}`} />
            경기상태 지금 새로고침
          </Button>
          <div className="text-right text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`w-2 h-2 rounded-full ${autoSyncStatus.data?.healthy ? "bg-green-500" : "bg-red-500"}`} />
              API 연동 {autoSyncStatus.data?.healthy ? "정상" : "오류"}
            </div>
            <div>마지막 동기화: {autoSyncStatus.data?.lastSyncAt ? new Date(autoSyncStatus.data.lastSyncAt).toLocaleString("ko-KR") : "-"}</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">정산 대기/오류</TabsTrigger>
          <TabsTrigger value="settled">정산 완료</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">로딩 중...</div>
            ) : (
              (matches ?? []).filter((m: any) => m.settleStatus !== "settled").map((m: any) => {
                const info = settleStatusInfo[m.settleStatus ?? "pending"] ?? settleStatusInfo.pending;
                const Icon = info.icon;
                return (
                  <div key={m.id} className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{m.sportIcon}</span>
                      <div className="flex-1">
                        <div className="font-bold">{m.homeTeam} {m.homeScore ?? "-"} : {m.awayScore ?? "-"} {m.awayTeam}</div>
                        <div className="text-sm text-muted-foreground">{m.leagueName} · {new Date(m.matchDate).toLocaleString("ko-KR")}</div>
                      </div>
                      <Badge className={`text-xs border ${info.color}`}><Icon className="w-3 h-3 mr-1" />{info.label}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Edit className="w-3 h-3 mr-1" />스코어 수정</Button>
                      <Button size="sm" onClick={() => runSettlement.mutate({ matchId: m.id })} disabled={runSettlement.isPending || m.homeScore == null}>
                        정산 실행 (봇 승률 갱신)
                      </Button>
                    </div>
                    {m.viewCount > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                        <span>조회수 {m.viewCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!isLoading && (matches ?? []).filter((m: any) => m.settleStatus !== "settled").length === 0 && (
              <div className="text-center py-16 text-muted-foreground">대기 중인 정산이 없습니다.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settled">
          <div className="flex flex-col gap-3">
            {(matches ?? []).filter((m: any) => m.settleStatus === "settled").map((m: any) => (
              <div key={m.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 opacity-80">
                <span className="text-xl">{m.sportIcon}</span>
                <div className="flex-1">
                  <div className="font-bold">{m.homeTeam} {m.homeScore} : {m.awayScore} {m.awayTeam}</div>
                  <div className="text-sm text-muted-foreground">{m.leagueName} · 정산 완료 · 분석가 승률 갱신됨</div>
                </div>
                <Badge className="text-xs border bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />완료</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>스코어 수동 수정 (API 오류 시에만 사용)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{editDialog.data?.homeTeam} (홈)</label>
              <Input type="number" value={scoreForm.homeScore ?? ""} onChange={(e) => setScoreForm({ ...scoreForm, homeScore: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{editDialog.data?.awayTeam} (원정)</label>
              <Input type="number" value={scoreForm.awayScore ?? ""} onChange={(e) => setScoreForm({ ...scoreForm, awayScore: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditDialog({ open: false })}>취소</Button>
            <Button className="flex-1" onClick={() => manualScoreUpdate.mutate({ id: editDialog.data.id, ...scoreForm })}>저장</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
