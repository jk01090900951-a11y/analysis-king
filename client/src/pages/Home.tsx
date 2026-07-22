import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import LiveScoreCarousel from "@/components/LiveScoreCarousel";
import AdBanner from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Trophy, TrendingUp, ChevronRight, Star, Shield, BarChart2, Clock, Flame } from "lucide-react";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  
  // 라이브 경기 데이터 쿼리 (진행 중이거나 예정된 경기)
  const { data: liveMatches, isLoading: isLiveMatchesLoading } = trpc.match.list.useQuery({
    status: undefined, // 모든 상태
    limit: 10,
  });

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: bots } = trpc.bot.list.useQuery();
  const { data: matches } = trpc.match.list.useQuery({ status: "scheduled", limit: 6 });
  const { data: botChampion } = trpc.botChampion.recent.useQuery();
  const { data: activeEvents } = trpc.event.activeEvents.useQuery();
  const { data: upcomingEvents } = trpc.event.upcomingEvents.useQuery({ limit: 3 });

  const topBots = bots?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryMenu />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="container relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              <span>정밀 분석 스포츠 예측 플랫폼</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              <span className="text-foreground">20명의 전문 분석가가</span><br />
              <span className="gold-text">경기 결과를 예측합니다</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              야구, 축구, 농구 등 다양한 스포츠 경기에서 전문 분석가의 예측을 확인하고,
              직접 예측에 참여해 포인트를 적립하세요. 참여만 해도 꼽 없이 적립됩니다.
            </p>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link href="/matches">
                  <Button size="lg" className="gold-gradient text-black font-bold hover:opacity-90">
                    경기 예측 참여하기 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="gold-gradient text-black font-bold hover:opacity-90" onClick={() => window.location.href = getLoginUrl()}>
                  무료로 시작하기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              <Link href="/bots">
                <Button size="lg" variant="outline" className="border-border hover:border-primary/50">
                  분석가 랭킹 보기
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-12 max-w-lg">
            {[
              { label: "전문 분석가", value: "20명", icon: "🏆" },
              { label: "참여 기본 포인트", value: "10P", icon: "🎁" },
              { label: "포인트 교환", value: "3종", icon: "💳" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-card border border-border">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Score Carousel */}
      <section className="py-12 border-t border-border bg-card/30">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">🔴 실시간 경기</h2>
              <p className="text-muted-foreground text-sm mt-1">진행 중이거나 예정된 경기를 확인하세요</p>
            </div>
          </div>
          <LiveScoreCarousel
            matches={liveMatches?.map((match: any) => ({
              id: match.id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              matchDate: match.matchDate,
              status: match.status,
              leagueName: match.leagueName,
              sportIcon: match.sportIcon,
            })) || []}
            isLoading={isLiveMatchesLoading}
          />
        </div>
      </section>

      {/* AdSense Banner - After Live Scores */}
      <section className="py-6 border-t border-border">
        <div className="container">
          <AdBanner slot="1234567890" format="horizontal" className="mx-auto" />
        </div>
      </section>

      {/* AI Bot Ranking Preview */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">분석가 적중률 랭킹</h2>
              <p className="text-muted-foreground text-sm mt-1">실시간 업데이트되는 전문 분석가 성적</p>
            </div>
            <Link href="/bots">
              <Button variant="ghost" size="sm" className="text-primary">전체보기 <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topBots.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>아직 분석가 데이터가 없습니다. 관리자가 초기 데이터를 설정하면 표시됩니다.</p>
              </div>
            ) : topBots.map((bot, i) => (
              <div key={bot.id} className={`relative p-5 rounded-2xl border card-hover ${i === 0 ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold rank-badge-${i + 1}`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{bot.name}</div>
                      <div className="text-xs text-muted-foreground">{bot.avatar}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{Number(bot.winRate).toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">승률</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <BarChart2 className="w-3 h-3" />
                  <span>총 {bot.totalPicks}픽 · {bot.correctPicks}적중</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sports Filter + Today's Matches */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">오늘의 경기</h2>
              <p className="text-muted-foreground text-sm mt-1">예측에 참여하고 포인트를 적립하세요</p>
            </div>
            <Link href="/matches">
              <Button variant="ghost" size="sm" className="text-primary">전체보기 <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>

          {/* Sport Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button className={`sport-chip ${selectedSport === null ? "active" : ""}`} onClick={() => setSelectedSport(null)}>
              전체
            </button>
            {sports?.map((sport) => (
              <button key={sport.id} className={`sport-chip ${selectedSport === sport.id ? "active" : ""}`} onClick={() => setSelectedSport(sport.id)}>
                {sport.icon} {sport.name}
              </button>
            ))}
          </div>

          {/* Match Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches?.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>등록된 경기가 없습니다.</p>
                <p className="text-sm mt-1">관리자가 경기를 등록하면 표시됩니다.</p>
              </div>
            ) : matches?.map((match: any) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <div className="p-5 rounded-2xl bg-card border border-border card-hover cursor-pointer">
                  {/* League & Sport */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{match.sportIcon}</span>
                      <span className="text-xs text-muted-foreground">{match.leagueName}</span>
                    </div>
                    <span className={statusClass[match.status] ?? "status-scheduled"}>{statusLabel[match.status] ?? match.status}</span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex-1 text-center">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">
                        {match.sportIcon}
                      </div>
                      <p className="text-sm font-semibold line-clamp-1">{match.homeTeam}</p>
                      <p className="text-xs text-muted-foreground">홈</p>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-xl font-bold text-muted-foreground">VS</div>
                      {match.status === "finished" && match.homeScore !== null && (
                        <div className="text-sm font-bold text-primary mt-1">{match.homeScore} - {match.awayScore}</div>
                      )}
                    </div>
                    <div className="flex-1 text-center">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">
                        {match.sportIcon}
                      </div>
                      <p className="text-sm font-semibold line-clamp-1">{match.awayTeam}</p>
                      <p className="text-xs text-muted-foreground">원정</p>
                    </div>
                  </div>

                  {/* Match Date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(match.matchDate).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <Zap className="w-3 h-3" />
                      <span>예측 참여</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 border-t border-border bg-card/30">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-10">이용 방법</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", icon: <Shield className="w-6 h-6" />, title: "로그인", desc: "소셜 계정으로 간편하게 가입하고 300P를 받으세요" },
              { step: "02", icon: <BarChart2 className="w-6 h-6" />, title: "분석글 읽기", desc: "전문 분석가와 회원들의 분석글을 누구나 자유롭게 읽을 수 있어요. 열람 제한 없음" },
              { step: "03", icon: <Zap className="w-6 h-6" />, title: "포인트 자동 적립", desc: "글을 읽거나 직접 작성하면 포인트가 쌓입니다. 광고 시청과는 무관해요" },
              { step: "04", icon: <Trophy className="w-6 h-6" />, title: "포인트 교환", desc: "적립된 포인트를 네이버페이·카카오페이·상품권으로 교환하세요" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-primary mb-1">STEP {item.step}</div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Point System */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-2">포인트 적립 방식</h2>
          <p className="text-center text-muted-foreground mb-8">참여만 해도 꽝 없이 포인트가 적립됩니다</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { title: "분석글 작성", points: "+1P", desc: "300자 이상 정상 게시물 작성 시 지급 (1일 최대 20개)", color: "text-blue-400", bg: "bg-blue-400/10" },
              { title: "분석글 조회", points: "최대 +8P", desc: "다른 회원이 내 글을 읽으면 등급별 포인트 지급, 글을 읽는 사람도 함께 적립", color: "text-primary", bg: "bg-primary/10" },
              { title: "분석왕 랭킹 보상", points: "+1,000~20,000P", desc: "주간·월간 분석왕 랭킹 상위 입상 시 지급", color: "text-green-400", bg: "bg-green-400/10" },
            ].map((item) => (
              <div key={item.title} className={`p-5 rounded-2xl border border-border ${item.bg}`}>
                <div className={`text-2xl font-bold ${item.color} mb-2`}>{item.points}</div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Ranking & Events */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <Tabs defaultValue="ranking" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="ranking">🏆 지난주·지난달 분석왕</TabsTrigger>
              <TabsTrigger value="events">🎁 진행 중인 이벤트</TabsTrigger>
            </TabsList>

            {/* Bot Champion (2026: 유저 랭킹 폐지, AI 분석가 랭킹 배지로 대체 — 포인트 상금 없음) */}
            <TabsContent value="ranking" className="space-y-3">
              {botChampion && (botChampion.weekly || botChampion.monthly) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {botChampion.weekly && (
                    <div className="p-4 rounded-lg bg-card border border-primary/30">
                      <div className="text-xs text-primary font-semibold mb-1">🗓️ 지난주 분석왕</div>
                      <div className="font-bold">봇 #{botChampion.weekly.botId}</div>
                      <div className="text-xs text-muted-foreground">승률 {botChampion.weekly.winRateAtWin}%</div>
                    </div>
                  )}
                  {botChampion.monthly && (
                    <div className="p-4 rounded-lg bg-card border border-primary/30">
                      <div className="text-xs text-primary font-semibold mb-1">📅 지난달 분석왕</div>
                      <div className="font-bold">봇 #{botChampion.monthly.botId}</div>
                      <div className="text-xs text-muted-foreground">승률 {botChampion.monthly.winRateAtWin}%</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">아직 집계된 분석왕이 없습니다.</div>
              )}
            </TabsContent>

            {/* Events */}
            <TabsContent value="events" className="space-y-3">
              {activeEvents && activeEvents.length > 0 ? (
                <div className="space-y-3">
                  {activeEvents.map((event: any) => (
                    <div key={event.id} className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-lg">{event.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        </div>
                        <Badge className="bg-primary">진행 중</Badge>
                      </div>
                      {event.prizes && (
                        <div className="mt-3 pt-3 border-t border-primary/20">
                          <div className="text-xs font-semibold text-primary mb-2">상금 정보</div>
                          <div className="grid grid-cols-3 gap-2">
                            {event.prizes.slice(0, 3).map((prize: any, idx: number) => (
                              <div key={idx} className="text-xs bg-white/5 rounded p-2">
                                <div className="font-bold text-primary">{prize.rank}위</div>
                                <div className="text-muted-foreground">{prize.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : upcomingEvents && upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-center py-8 text-muted-foreground mb-4">현재 진행 중인 이벤트가 없습니다.</div>
                  <div>
                    <h3 className="font-bold mb-3 text-sm">예정된 이벤트</h3>
                    {upcomingEvents.map((event: any) => (
                      <div key={event.id} className="p-3 rounded-lg bg-card border border-border text-sm mb-2">
                        <div className="font-semibold">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(event.startDate).toLocaleDateString('ko-KR')} 시작
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">이벤트 정보가 없습니다.</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Exchange Preview */}
      <section className="py-12 border-t border-border bg-card/30">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">포인트 교환소</h2>
              <p className="text-muted-foreground text-sm mt-1">적립된 포인트를 실생활에서 사용하세요</p>
            </div>
            <Link href="/exchange">
              <Button variant="ghost" size="sm" className="text-primary">교환하기 <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md">
            {[
              { name: "네이버페이", emoji: "🟢", desc: "1,000P~" },
              { name: "카카오페이", emoji: "🟡", desc: "1,000P~" },
              { name: "모바일 상품권", emoji: "🎁", desc: "5,000P~" },
            ].map((item) => (
              <div key={item.name} className="p-4 rounded-xl bg-card border border-border text-center card-hover">
                <div className="text-3xl mb-2">{item.emoji}</div>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p className="mb-2">분석왕은 무상 포인트 기반 스포츠 분석 커뮤니티 서비스입니다.</p>
          <p>포인트는 현금 충전이 불가하며, 서비스 이용 수단으로만 제공됩니다.</p>
          <p className="mt-4 text-xs">© 2026 분석왕. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
