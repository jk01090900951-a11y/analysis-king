import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, Trophy, FileText, Swords, ArrowRight, Database } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const utils = trpc.useUtils();
  const { data: stats } = trpc.admin.stats.useQuery();
  const seedData = trpc.admin.seedData.useMutation({
    onSuccess: () => { toast.success("초기 데이터 시딩 완료! (종목·리그·분석가 20명)"); utils.admin.stats.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const statCards = [
    { icon: Shield, label: "관리자 계정", value: stats?.totalAdmins ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: Swords, label: "등록 경기", value: stats?.totalMatches ?? 0, color: "text-primary", bg: "bg-primary/10" },
    { icon: Trophy, label: "분석가(봇)", value: stats?.totalBots ?? 0, color: "text-green-400", bg: "bg-green-500/10" },
    { icon: FileText, label: "생성된 분석글", value: stats?.totalAnalyses ?? 0, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  const quickLinks = [
    { href: "/admin/sports", label: "종목·리그 관리", desc: "종목 및 리그 tier(빅리그/비인기) 관리" },
    { href: "/admin/matches", label: "경기·분석글 생성", desc: "경기 목록 확인 및 AI 픽/분석글 생성" },
    { href: "/admin/bots", label: "분석가 관리", desc: "20명 분석가 정보 및 가중치 관리" },
    { href: "/admin/settle", label: "결과 정산", desc: "경기 결과 확인 및 봇 승률 정산" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="text-muted-foreground mt-1">분석왕 운영 현황을 확인하세요.</p>
        </div>
        {(stats?.totalBots ?? 0) === 0 && (
          <Button onClick={() => seedData.mutate()} disabled={seedData.isPending} className="gold-gradient text-black font-bold">
            <Database className="w-4 h-4 mr-2" />
            {seedData.isPending ? "생성 중..." : "초기 데이터 시딩 (종목·분석가 20명)"}
          </Button>
        )}
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
