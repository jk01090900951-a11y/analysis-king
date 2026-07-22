import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, Coins, Ban, ShieldCheck, ShieldOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusInfo: Record<string, { label: string; color: string }> = {
  active: { label: "정상", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  warned: { label: "경고(1단계)", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  restricted: { label: "제한(2단계)", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  suspended: { label: "정지(3단계)", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  banned: { label: "영구정지(4단계)", color: "bg-red-700/30 text-red-300 border-red-700/40" },
};

export default function AdminUsers() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { data: users, isLoading } = trpc.admin.userList.useQuery({ search, role: roleFilter === "all" ? undefined : (roleFilter as "user" | "admin") });
  const [detailUser, setDetailUser] = useState<any>(null);
  const [pointDialog, setPointDialog] = useState<{ open: boolean; userId?: number }>({ open: false });
  const [pointAmount, setPointAmount] = useState<number>(0);
  const [pointReason, setPointReason] = useState("");

  const { data: userDetail } = trpc.admin.userDetail.useQuery({ userId: detailUser?.id }, { enabled: !!detailUser });

  const adjustPoint = trpc.admin.adjustUserPoint.useMutation({
    onSuccess: () => { toast.success("포인트 처리 완료"); utils.admin.userList.invalidate(); setPointDialog({ open: false }); setPointAmount(0); setPointReason(""); },
    onError: (e) => toast.error(e.message),
  });
  const changeStatus = trpc.admin.updateUserStatus.useMutation({
    onSuccess: () => { toast.success("계정 상태 변경 완료"); utils.admin.userList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleAdminRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { toast.success("권한 변경 완료"); utils.admin.userList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">회원 관리</h1>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="닉네임 또는 이메일 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 회원</SelectItem>
            <SelectItem value="user">일반 회원</SelectItem>
            <SelectItem value="admin">관리자만</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-accent/30">
              <th className="text-left p-3 text-muted-foreground font-medium">닉네임</th>
              <th className="text-left p-3 text-muted-foreground font-medium">이메일</th>
              <th className="text-left p-3 text-muted-foreground font-medium">가입일</th>
              <th className="text-left p-3 text-muted-foreground font-medium">최종 로그인</th>
              <th className="text-right p-3 text-muted-foreground font-medium">보유 포인트</th>
              <th className="text-center p-3 text-muted-foreground font-medium">상태</th>
              <th className="text-center p-3 text-muted-foreground font-medium">권한</th>
              <th className="text-center p-3 text-muted-foreground font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">로딩 중...</td></tr>
            ) : (users ?? []).map((u: any) => {
              const info = statusInfo[u.accountStatus ?? "active"] ?? statusInfo.active;
              return (
                <tr key={u.id} className="border-b border-border/20 last:border-0 hover:bg-accent/20">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="p-3 text-muted-foreground text-xs">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("ko-KR") : "-"}</td>
                  <td className="p-3 text-right font-semibold">{(u.points ?? 0).toLocaleString()}P</td>
                  <td className="p-3 text-center"><Badge className={`text-xs border ${info.color}`}>{info.label}</Badge></td>
                  <td className="p-3 text-center">
                    {u.role === "admin" ? (
                      <Badge className="text-xs bg-primary/20 text-primary border-primary/30">관리자</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">일반</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" title="상세 보기" onClick={() => setDetailUser(u)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="포인트 지급/회수" onClick={() => setPointDialog({ open: true, userId: u.id })}><Coins className="w-3.5 h-3.5" /></Button>
                      <Button
                        size="sm" variant="ghost" title={u.role === "admin" ? "관리자 권한 해제" : "관리자로 지정"}
                        onClick={() => toggleAdminRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      >
                        {u.role === "admin" ? <ShieldOff className="w-3.5 h-3.5 text-destructive" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      </Button>
                      <Select value={u.accountStatus ?? "active"} onValueChange={(v) => changeStatus.mutate({ userId: u.id, status: v as "active" | "warned" | "restricted" | "suspended" | "banned" })}>
                        <SelectTrigger className="w-8 h-8 p-0 border-0"><Ban className="w-3.5 h-3.5 mx-auto text-muted-foreground" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusInfo).map(([v, i]) => <SelectItem key={v} value={v}>{i.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 상세보기 */}
      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailUser?.name} 상세 정보</DialogTitle></DialogHeader>
          <Tabs defaultValue="points">
            <TabsList className="mb-3">
              <TabsTrigger value="points">포인트 내역</TabsTrigger>
              <TabsTrigger value="views">조회 내역</TabsTrigger>
              <TabsTrigger value="reports">신고/제재 이력</TabsTrigger>
            </TabsList>
            <TabsContent value="points" className="space-y-2 max-h-64 overflow-y-auto">
              {(userDetail?.pointHistory ?? []).map((h: any) => (
                <div key={h.id} className="flex justify-between text-xs p-2 rounded bg-accent/30">
                  <span>{h.description}</span>
                  <span className={h.amount > 0 ? "text-green-400" : "text-red-400"}>{h.amount > 0 ? "+" : ""}{h.amount}P</span>
                </div>
              ))}
              {!userDetail?.pointHistory?.length && <p className="text-xs text-muted-foreground text-center py-6">내역 없음</p>}
            </TabsContent>
            <TabsContent value="views" className="space-y-2 max-h-64 overflow-y-auto">
              {(userDetail?.viewHistory ?? []).map((v: any) => (
                <div key={v.id} className="flex justify-between text-xs p-2 rounded bg-accent/30">
                  <span>{v.matchTitle}</span>
                  <span className="text-muted-foreground">{new Date(v.viewedAt).toLocaleDateString("ko-KR")}</span>
                </div>
              ))}
              {!userDetail?.viewHistory?.length && <p className="text-xs text-muted-foreground text-center py-6">조회 내역 없음 (유저 글쓰기 폐지로 "작성글" 항목은 표시하지 않음)</p>}
            </TabsContent>
            <TabsContent value="reports" className="space-y-2 max-h-64 overflow-y-auto">
              {(userDetail?.reportHistory ?? []).map((r: any) => (
                <div key={r.id} className="text-xs p-2 rounded bg-accent/30">{r.reason} · {new Date(r.createdAt).toLocaleDateString("ko-KR")}</div>
              ))}
              {!userDetail?.reportHistory?.length && <p className="text-xs text-muted-foreground text-center py-6">신고/제재 이력 없음</p>}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* 포인트 지급/회수 */}
      <Dialog open={pointDialog.open} onOpenChange={(o) => setPointDialog({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>포인트 수동 지급 / 회수</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">금액 (음수 입력 시 회수)</label>
              <Input type="number" value={pointAmount} onChange={(e) => setPointAmount(Number(e.target.value))} placeholder="예: 500 또는 -500" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">사유</label>
              <Input value={pointReason} onChange={(e) => setPointReason(e.target.value)} placeholder="예: 이벤트 보상, 오류 정정" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setPointDialog({ open: false })}>취소</Button>
            <Button className="flex-1" onClick={() => pointDialog.userId && adjustPoint.mutate({ userId: pointDialog.userId, amount: pointAmount, reason: pointReason })}>
              적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
