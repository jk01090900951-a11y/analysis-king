import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Exchange() {
  const { isAuthenticated } = useAuth();
  const { data: methods } = trpc.exchange.methods.useQuery();
  const { data: myRequests } = trpc.exchange.myRequests.useQuery(undefined, { enabled: isAuthenticated });
  const [dialogMethod, setDialogMethod] = useState<any>(null);
  const [points, setPoints] = useState(10000);
  const { data: maxInfo } = trpc.exchange.maxRequestable.useQuery({ methodId: dialogMethod?.id }, { enabled: !!dialogMethod });

  const request = trpc.exchange.request.useMutation({
    onSuccess: () => { toast.success("교환 신청이 접수되었습니다."); setDialogMethod(null); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground mb-4">로그인 후 이용 가능합니다.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>로그인</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-black mb-2">💰 포인트 교환소</h1>
        <p className="text-sm text-muted-foreground mb-6">최소 10,000P부터, 1,000P 단위로 신청 가능합니다.</p>

        <Tabs defaultValue="methods">
          <TabsList className="mb-4">
            <TabsTrigger value="methods">교환 수단</TabsTrigger>
            <TabsTrigger value="history">교환 내역</TabsTrigger>
          </TabsList>
          <TabsContent value="methods" className="space-y-3">
            {(methods ?? []).map((m: any) => (
              <div key={m.id} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{m.name}</p>
                  <p className="text-xs text-muted-foreground">1P = {m.conversionRate}원 · 최소 {m.minPoints.toLocaleString()}P</p>
                </div>
                <Button size="sm" onClick={() => { setDialogMethod(m); setPoints(m.minPoints); }}>교환 신청</Button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="history" className="space-y-2">
            {(myRequests ?? []).map((r: any) => (
              <div key={r.id} className="p-3 rounded-lg bg-accent/30 text-sm flex justify-between">
                <span>{r.points.toLocaleString()}P → {r.amount}원</span>
                <span className="text-muted-foreground">{r.status}</span>
              </div>
            ))}
            {!myRequests?.length && <p className="text-sm text-muted-foreground text-center py-10">교환 내역이 없습니다.</p>}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!dialogMethod} onOpenChange={() => setDialogMethod(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogMethod?.name} 교환 신청</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              최대 신청 가능: {maxInfo?.max?.toLocaleString() ?? "-"}P (보유 {(maxInfo as any)?.balance?.toLocaleString() ?? "-"}P 중 1,000P 단위, 잔여 {maxInfo?.remainder?.toLocaleString() ?? 0}P는 계정에 남음)
            </p>
            <Input type="number" step={1000} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </div>
          <Button className="w-full mt-2" onClick={() => request.mutate({ methodId: dialogMethod.id, points })} disabled={request.isPending}>
            신청하기
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
