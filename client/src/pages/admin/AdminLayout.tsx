import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { LayoutDashboard, Trophy, Calendar, CheckCircle, Gift, Users, Settings, Zap, ChevronRight } from "lucide-react";

const adminNav = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/sports", label: "종목·리그 관리", icon: Settings },
  { href: "/admin/matches", label: "경기 등록", icon: Calendar },
  { href: "/admin/bots", label: "AI 봇 관리", icon: Trophy },
  { href: "/admin/settle", label: "결과 입력·정산", icon: CheckCircle },
  { href: "/admin/exchange", label: "교환소 관리", icon: Gift },
  { href: "/admin/users", label: "회원 관리", icon: Users },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">로딩 중...</div>
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
        <button className="px-4 py-2 rounded-lg gold-gradient text-black font-semibold" onClick={() => window.location.href = getLoginUrl()}>로그인</button>
      </div>
    </div>
  );

  if (user?.role !== "admin") return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">관리자 권한이 필요합니다.</p>
        <Link href="/"><button className="px-4 py-2 rounded-lg bg-accent text-foreground">홈으로</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 bg-sidebar-background border-r border-sidebar-border flex flex-col">
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
                <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link href="/">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              ← 사용자 화면으로
            </button>
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
