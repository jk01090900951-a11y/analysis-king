import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShieldOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// 2026: 회원가입 폐지 — 이 화면은 "관리자 계정" 목록/추가/삭제만 관리합니다.
export default function AdminUsers() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.userList.useQuery({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "" });

  const removeAdmin = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => { toast.success("관리자 계정 삭제 완료"); utils.admin.userList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const createAdmin = trpc.admin.createAdmin.useMutation({
    onSuccess: () => { toast.success("관리자 계정 추가 완료"); utils.admin.userList.invalidate(); setAddOpen(false); setForm({ username: "", password: "", name: "" }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">관리자 계정 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">회원가입이 폐지되어 아이디/비밀번호로 로그인하는 관리자 계정만 표시됩니다.</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" />관리자 추가</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 bg-accent/30">
              <th className="text-left p-3 text-muted-foreground font-medium">아이디</th>
              <th className="text-left p-3 text-muted-foreground font-medium">이름</th>
              <th className="text-left p-3 text-muted-foreground font-medium">생성일</th>
              <th className="text-left p-3 text-muted-foreground font-medium">최종 로그인</th>
              <th className="text-center p-3 text-muted-foreground font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">로딩 중...</td></tr>
            ) : (users ?? []).map((u: any) => (
              <tr key={u.id} className="border-b border-border/20 last:border-0 hover:bg-accent/20">
                <td className="p-3 font-medium">{u.username}</td>
                <td className="p-3 text-muted-foreground">{u.name}</td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="p-3 text-muted-foreground text-xs">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("ko-KR") : "-"}</td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="ghost" title="관리자 계정 삭제" onClick={() => removeAdmin.mutate({ userId: u.id })}>
                    <ShieldOff className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>관리자 계정 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="아이디 (3자 이상)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input type="password" placeholder="비밀번호 (8자 이상)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input placeholder="이름 (선택)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <Button className="w-full mt-3" onClick={() => createAdmin.mutate(form)} disabled={createAdmin.isPending}>
            추가
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
