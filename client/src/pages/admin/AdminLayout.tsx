import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LayoutDashboard, Trophy, Calendar, CheckCircle, Users, Settings, Zap, ChevronRight, Menu, Megaphone } from "lucide-react";

const adminNav = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/sports", label: "종목·리그 관리", icon: Settings },
  { href: "/admin/matches", label: "경기 등록", icon: Calendar },
  { href: "/admin/bots", label: "AI 봇 관리", icon: Trophy },
  { href: "/admin/settle", label: "결과 입력·정산", icon: CheckCircle },
  { href: "/admin/settings", label: "광고 설정", icon: Megaphone },
  { href: "/admin/users", label: "관리자 계정 관리", icon: Users },
];

function AdminLoginForm() {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <form
        onSubmit={(e) => { e.preventDefault(); login.mutate({ username, password }); }}
        className="w-full max-w-sm p-6 rounded-xl border border-border bg-card space-y-4"
      >
        <div className="text-center mb-2">
          <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center mx-auto mb-2"><Zap className="w-5 h-5 text-black" /></div>
          <h1 className="font-bold text-lg">관리자 로그인</h1>
        </div>
        <Input placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <Input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <Button type="submit" className="w-full gold-gradient text-black font-bold" disabled={login.isPending}>
          {login.isPending ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">로딩 중...</div>
    </div>
  );

  if (!isAuthenticated) return <AdminLoginForm />;

  const navContent = (
    <>
      <div className="p-5 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-bold text-sm gold-text">분석왕</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1">관리자 대시보드</p>
      </div>
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {adminNav.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href}>
              <button onClick={() => setMobileNavOpen(false)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </button>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link href="/">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
            ← 사용자 화면으로
          </button>
        </Link>
        <AdminLogoutButton />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* 데스크탑: 고정 사이드바 */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-sidebar-background border-r border-sidebar-border flex-col">
        {navContent}
      </aside>

      {/* 모바일: 상단바 + 슬라이드 사이드바 */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar-background flex flex-col">
          {navContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}><Menu className="w-5 h-5" /></Button>
          <span className="font-bold text-sm gold-text">분석왕 관리자</span>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function AdminLogoutButton() {
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  return (
    <button
      onClick={() => logout.mutate()}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-all"
    >
      로그아웃
    </button>
  );
}
