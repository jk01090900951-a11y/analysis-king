import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Trophy, TrendingUp, Target, Zap, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";

const strategyLabel: Record<string, string> = {
  head_to_head: "상대전적 위주", recent_form: "최근폼 위주",
  data_driven: "데이터 종합", fatigue_based: "컨디션/피로도", balanced: "균형 분석"
};
const strategyDesc: Record<string, string> = {
  head_to_head: "두 팀의 역대 맞대결 기록을 가장 중요하게 분석합니다.",
  recent_form: "최근 5경기 성적과 현재 흐름을 최우선으로 반영합니다.",
  data_driven: "득점, 실점, 점유율 등 모든 통계를 종합 분석합니다.",
  fatigue_based: "선수 출전 시간, 경기 간격, 부상 정보를 중점 분석합니다.",
  balanced: "모든 요소를 균형 있게 반영하는 종합 분석입니다."
};

export default function Bots() {
  const { data: bots, isLoading } = trpc.bot.list.useQuery();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">전문 분석가 적중률 랭킹</h1>
          <p className="text-muted-foreground">20명의 전문 분석가가 각자의 전략으로 경기를 분석합니다. 적중률 기준으로 순위가 실시간 업데이트됩니다.</p>
        </div>

        {/* 랭킹 설명 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-yellow-500" /><span className="font-bold text-yellow-500">1~5위 분석가</span></div>
            <p className="text-sm text-muted-foreground">분석글은 누구나 자유롭게 열람 가능 (읽으면 포인트 자동 적립)</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-gray-400" /><span className="font-bold text-gray-400">6~20위 분석가</span></div>
            <p className="text-sm text-muted-foreground">분석글 무료 공개</p>
          </div>
          <div className="p-4 rounded-xl bg-accent border border-border">
            <div className="flex items-center gap-2 mb-2"><Zap className="w-5 h-5 text-primary" /><span className="font-bold">순위 업데이트</span></div>
            <p className="text-sm text-muted-foreground">적중률 기준 매주 실시간 순위 변동</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
        ) : (
          <div className="flex flex-col gap-4">
            {(bots ?? []).sort((a: any, b: any) => (a.currentRank ?? 99) - (b.currentRank ?? 99)).map((bot: any) => {
              const rank = bot.currentRank ?? 99;
              const winRate = Number(bot.winRate ?? 0);
              const weights = bot.weights as any ?? {};
              return (
                <div key={bot.id} className={`p-6 rounded-2xl border cursor-pointer transition-all hover:shadow-lg ${rank <= 5 ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`} onClick={() => setLocation(`/analyst/${bot.id}`)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black ${rank === 1 ? "bg-yellow-500 text-black" : rank === 2 ? "bg-gray-400 text-black" : rank === 3 ? "bg-amber-700 text-white" : rank <= 5 ? "bg-primary/20 text-primary" : "bg-accent text-foreground"}`}>
                        {rank}
                      </div>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: bot.color + "20", border: `2px solid ${bot.color}40` }}>
                        {bot.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold">{bot.name}</h3>
                          {rank <= 5 && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">{rank <= 3 ? `🏅 TOP ${rank}` : `🔒 TOP ${rank}`}</Badge>}
                          {bot.currentStreak >= 3 && <Badge className="text-xs bg-red-500 text-white flex items-center gap-1"><Flame className="w-3 h-3" />{bot.currentStreak}연</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{strategyLabel[bot.strategy] ?? bot.strategy}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-primary">{winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">승률</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>승률</span><span>{bot.correctPicks ?? 0}/{bot.totalPicks ?? 0}회</span>
                    </div>
                    <Progress value={winRate} className="h-2 mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">{strategyDesc[bot.strategy] ?? ""}</p>

                    {/* 가중치 시각화 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "상대전적", value: weights.headToHead ?? 0, icon: <Target className="w-3 h-3" /> },
                        { label: "최근폼", value: weights.recentForm ?? 0, icon: <TrendingUp className="w-3 h-3" /> },
                        { label: "홈/원정", value: weights.homeAway ?? 0, icon: <Zap className="w-3 h-3" /> },
                        { label: "피로도", value: weights.fatigue ?? 0, icon: <Zap className="w-3 h-3" /> },
                      ].map(w => (
                        <div key={w.label} className="p-2 rounded-lg bg-accent/50">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">{w.icon}{w.label}</div>
                          <div className="text-sm font-bold">{(w.value * 100).toFixed(0)}%</div>
                          <Progress value={w.value * 100} className="h-1 mt-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
