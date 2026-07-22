import { trpc } from "@/lib/trpc";
import { Users, Trophy, Target, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { data: stats } = trpc.admin.stats.useQuery();

  const statCards = [
    { icon: Users, label: "총 회원", value: stats?.totalUsers ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: Trophy, label: "대기중 교환신청", value: stats?.pendingExchanges ?? 0, color: "text-primary", bg: "bg-primary/10" },
    { icon: Target, label: "총 예측 참여", value: stats?.totalPredictions ?? 0, color: "text-green-400", bg: "bg-green-500/10" },
    { icon: Clock, label: "교환 대기", value: stats?.pendingExchanges ?? 0, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  const quickLinks = [
    { href: "/admin/categories", label: "카테고리 추가", desc: "새 카테고리 생성 및 관리" },
    { href: "/admin/cards", label: "예측 카드 생성", desc: "새 예측 카드 등록" },
    { href: "/admin/settle", label: "결과 입력", desc: "경기 결과 입력 및 포인트 정산" },
    { href: "/admin/exchange", label: "교환 처리", desc: "교환 신청 처리 및 수단 관리" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-muted-foreground mt-1">분석왕 운영 현황을 확인하세요.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="rounded-xl border border-border/50 bg-card p-5">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <h2 className="text-lg font-semibold text-foreground mb-4">빠른 작업</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickLinks.map(({ href, label, desc }) => (
          <Link key={href} href={href}>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer group">
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{label}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
