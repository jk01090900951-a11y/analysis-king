import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminExchange() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.exchange.allRequests.useQuery();

  const updateStatus = trpc.exchange.updateRequestStatus.useMutation({
    onSuccess: () => { toast.success("처리 완료"); utils.exchange.allRequests.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">교환소 관리</h1>
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">로딩 중...</div>
        ) : (
          (requests ?? []).map((r: any) => (
            <div key={r.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4">
              <div className="flex-1">
                <div className="font-bold text-sm">{r.userName ?? `유저 #${r.userId}`} — {r.points?.toLocaleString()}P → {r.amount}원</div>
                <div className="text-xs text-muted-foreground">{r.methodName} · {new Date(r.createdAt).toLocaleString("ko-KR")}</div>
              </div>
              <Badge variant="outline">{r.status}</Badge>
              {r.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}>승인</Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}>거절</Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
