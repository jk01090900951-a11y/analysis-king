import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Coins, Trophy, Target, TrendingUp, CheckCircle, XCircle, Clock, Gift } from "lucide-react";
import { toast } from "sonner";

const pointTypeLabel: Record<string, { label: string; color: string }> = {
  earn_base: { label: "기본 적립", color: "text-blue-400" },
  earn_correct: { label: "정답 보상", color: "text-green-400" },
  earn_event: { label: "이벤트", color: "text-purple-400" },
  spend_bet: { label: "베팅", color: "text-orange-400" },
  spend_exchange: { label: "교환", color: "text-red-400" },
};

export default function MyPage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
          <h2 className="text-2xl font-bold text-foreground mb-3">로그인이 필요합니다</h2>
          <p className="text-muted-foreground mb-6">마이페이지를 이용하려면 로그인해주세요.</p>
          <Button className="gold-gradient text-background font-bold" onClick={() => window.location.href = getLoginUrl()}>
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  const { data: balance } = trpc.point.balance.useQuery();
  const { data: pointHistory } = trpc.point.history.useQuery();
  const { data: myPredictions } = trpc.prediction.myList.useQuery();

  const utils = trpc.useUtils();

  const settledPredictions = myPredictions?.filter((p) => p.isSettled) ?? [];
  const correctCount = settledPredictions.filter((p) => p.isCorrect).length;
  const accuracy = settledPredictions.length > 0 ? Math.round((correctCount / settledPredictions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-4xl">
        {/* Profile Header */}
        <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6 card-glow">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{user?.name ?? "사용자"}</h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Coins, label: "보유 포인트", value: `${(balance?.points ?? 0).toLocaleString()}P`, color: "text-primary" },
            { icon: TrendingUp, label: "총 획득", value: `${(balance?.totalEarned ?? 0).toLocaleString()}P`, color: "text-green-400" },
            { icon: Target, label: "예측 적중률", value: `${accuracy}%`, color: "text-blue-400" },
            { icon: Trophy, label: "참여 횟수", value: `${myPredictions?.length ?? 0}회`, color: "text-purple-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card p-4 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-2 ${color}`} />
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="predictions">
          <TabsList className="mb-6 bg-card border border-border/50">
            <TabsTrigger value="predictions">예측 내역</TabsTrigger>
            <TabsTrigger value="points">포인트 내역</TabsTrigger>
          </TabsList>

          <TabsContent value="predictions">
            {!myPredictions || myPredictions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>아직 참여한 예측이 없습니다.</p>
                <Link href="/matches">
                  <Button className="mt-4 gold-gradient text-background font-semibold" size="sm">예측 참여하기</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myPredictions.map((pred) => (
                  <div key={pred.id} className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {pred.isSettled ? (
                        pred.isCorrect ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{pred.homeTeam} vs {pred.awayTeam}</p>
                        <p className="text-xs text-muted-foreground">선택: {pred.wdlChoice ?? pred.ouChoice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {pred.isSettled ? (
                        <div>
                          <span className="text-sm font-semibold text-green-400">+{pred.bonusPointsEarned + pred.basePointsEarned}P</span>
                          <p className="text-xs text-muted-foreground">{new Date(pred.createdAt).toLocaleDateString("ko-KR")}</p>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">대기중</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="points">
            {!pointHistory || pointHistory.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>포인트 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left p-4 text-muted-foreground font-medium">일시</th>
                      <th className="text-left p-4 text-muted-foreground font-medium">내용</th>
                      <th className="text-right p-4 text-muted-foreground font-medium">포인트</th>
                      <th className="text-right p-4 text-muted-foreground font-medium">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointHistory.map((h) => {
                      const typeInfo = pointTypeLabel[h.type] ?? { label: h.type, color: "text-foreground" };
                      const isEarn = h.amount > 0;
                      return (
                        <tr key={h.id} className="border-b border-border/20 last:border-0">
                          <td className="p-4 text-muted-foreground text-xs">{new Date(h.createdAt).toLocaleDateString("ko-KR")}</td>
                          <td className="p-4">
                            <span className={`text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                            {h.description && <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>}
                          </td>
                          <td className={`p-4 text-right font-semibold ${isEarn ? "text-green-400" : "text-red-400"}`}>
                            {isEarn ? "+" : ""}{h.amount.toLocaleString()}P
                          </td>
                          <td className="p-4 text-right text-muted-foreground">{h.balance.toLocaleString()}P</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
