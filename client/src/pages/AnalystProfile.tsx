import { useParams, Link } from "wouter";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy } from "lucide-react";

export default function AnalystProfile() {
  const { id } = useParams<{ id: string }>();
  const botId = Number(id);
  const { data: bot } = trpc.botProfile.get.useQuery({ botId });
  const { data: recentPicks } = trpc.botProfile.recentPicks.useQuery({ botId });

  if (!bot) return <div><Navbar /><div className="container py-20 text-center text-muted-foreground">로딩 중...</div></div>;

  return (
    <div>
      <Navbar />
      <CategoryMenu />
      <div className="container py-6 max-w-2xl">
        <Link href="/bots"><a className="flex items-center gap-1 text-sm text-muted-foreground mb-4"><ArrowLeft className="w-4 h-4" />분석가 목록</a></Link>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: `${bot.color}22`, border: `2px solid ${bot.color}66` }}>{bot.avatar}</div>
          <div>
            <h1 className="text-xl font-black">{bot.name}</h1>
            <p className="text-sm text-muted-foreground">{bot.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <p className="text-2xl font-black text-primary">{Number(bot.winRate ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">승률</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <p className="text-2xl font-black">{bot.totalPicks}</p>
            <p className="text-xs text-muted-foreground">총 픽</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <p className="text-2xl font-black">{bot.currentRank || "-"}위</p>
            <p className="text-xs text-muted-foreground">현재 순위</p>
          </div>
        </div>
        <h2 className="font-bold mb-3 flex items-center gap-1.5"><Trophy className="w-4 h-4" />최근 픽</h2>
        <div className="space-y-2">
          {(recentPicks ?? []).map((p: any) => (
            <div key={p.id} className="p-3 rounded-lg bg-card border border-border text-sm flex justify-between">
              <span>{p.matchTitle ?? `경기 #${p.matchId}`}</span>
              <Badge variant={p.isCorrect ? "default" : "outline"}>{p.isCorrect === null ? "예정" : p.isCorrect ? "적중" : "실패"}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
