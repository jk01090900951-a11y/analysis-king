import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import AdNoticeBanner from "@/components/AdNoticeBanner";
import Footer from "@/components/Footer";
import LiveScoreCarousel from "@/components/LiveScoreCarousel";
import AdBanner from "@/components/AdBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Trophy, TrendingUp, ChevronRight, Star, Shield, BarChart2, Clock, Flame } from "lucide-react";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

export default function Home() {
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  
  // 라이브 경기 데이터 쿼리 (오늘의 경기를 메인에서 강조 노출)
  const { data: liveMatches, isLoading: isLiveMatchesLoading } = trpc.match.list.useQuery({
    status: undefined, // 모든 상태
    limit: 30,
  });

  const todayStr = new Date().toDateString();
  const todayMatches = (liveMatches ?? []).filter((m: any) => new Date(m.matchDate).toDateString() === todayStr);
  const displayMatches = todayMatches.length > 0 ? todayMatches : (liveMatches ?? []).slice(0, 10);

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: bots } = trpc.bot.list.useQuery();
  const { data: matches } = trpc.match.list.useQuery({ status: "scheduled", limit: 6 });
  const { data: botChampion } = trpc.botChampion.recent.useQuery();

  const topBots = bots?.slice(0, 3) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <AdNoticeBanner />
      <CategoryMenu />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="container relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              <span>정밀 분석 스포츠 콘텐츠</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              <span className="text-foreground">20명의 분석가가</span><br />
              <span className="gold-text">경기 결과를 분석합니다</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              야구, 축구, 농구 등 다양한 스포츠 경기 분석글을 회원가입 없이 누구나 무료로 열람할 수 있습니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/matches">
                <Button size="lg" className="gold-gradient text-black font-bold hover:opacity-90">
                  경기 분석 보러가기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
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
              { label: "분석가", value: "20명", icon: "🏆" },
              { label: "회원가입", value: "불필요", icon: "🔓" },
              { label: "이용료", value: "무료", icon: "🎁" },
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

      {/* 오늘의 경기 — 메인 최상단 강조 섹션 */}
      <section className="py-10 md:py-12 border-t border-border bg-card/30">
        <div className="container px-4 md:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />오늘의 경기
                </span>
              </h2>
              <p className="text-muted-foreground text-xs md:text-sm mt-1">
                {todayMatches.length > 0 ? `오늘 예정된 ${todayMatches.length}개 경기` : "가장 가까운 예정 경기를 보여드립니다"}
              </p>
            </div>
            <Link href="/matches">
              <Button variant="ghost" size="sm" className="text-primary shrink-0">전체보기 <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
          <LiveScoreCarousel
            matches={displayMatches.map((match: any) => ({
              id: match.id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              matchDate: match.matchDate,
              status: match.status,
              leagueName: match.leagueName,
              sportIcon: match.sportIcon,
            }))}
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
              <p className="text-muted-foreground text-sm mt-1">분석가들의 경기 분석을 확인하세요</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", icon: <BarChart2 className="w-6 h-6" />, title: "경기 선택", desc: "관심 있는 경기를 골라주세요. 회원가입 없이 바로 이용할 수 있습니다" },
              { step: "02", icon: <Zap className="w-6 h-6" />, title: "분석글 읽기", desc: "20명의 분석가가 쓴 분석글을 자유롭게 읽어보세요. 열람 제한이 전혀 없습니다" },
              { step: "03", icon: <Trophy className="w-6 h-6" />, title: "무료 이용", desc: "모든 콘텐츠는 광고 수익만으로 운영됩니다. 결제나 가입 없이 계속 이용하실 수 있어요" },
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

      {/* Why Free */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-2">완전 무료로 운영됩니다</h2>
          <p className="text-center text-muted-foreground mb-8">회원가입도, 결제도 필요 없습니다 — 광고 수익만으로 서비스를 운영합니다</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { title: "회원가입 불필요", points: "🔓", desc: "누구나 로그인 없이 바로 모든 분석글을 볼 수 있습니다", color: "text-blue-400", bg: "bg-blue-400/10" },
              { title: "전체 무료 열람", points: "📖", desc: "20명 분석가의 모든 분석글을 제한 없이 자유롭게 읽을 수 있습니다", color: "text-primary", bg: "bg-primary/10" },
              { title: "광고로만 운영", points: "📣", desc: "결제 없이, 페이지 배너와 이탈 시 전면광고로만 서비스를 운영합니다", color: "text-green-400", bg: "bg-green-400/10" },
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

      {/* Bot Champion */}
      <section className="py-12 border-t border-border">
        <div className="container">
          <Tabs defaultValue="ranking" className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-6">
              <TabsTrigger value="ranking">🏆 지난주·지난달 분석왕</TabsTrigger>
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
          </Tabs>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
