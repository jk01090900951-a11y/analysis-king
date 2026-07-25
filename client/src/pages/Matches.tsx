import { useState, useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import Footer from "@/components/Footer";
import { useFavoriteSports } from "@/_core/hooks/useFavoriteSports";
import { useFavoriteMatches } from "@/_core/hooks/useFavoriteMatches";
import { Clock, Zap, Filter, Star, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatLiveStatus } from "@/lib/matchStatus";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function MatchCard({ match, isFav, onToggleFav }: { match: any; isFav: boolean; onToggleFav: () => void }) {
  const matchYear = new Date(match.matchDate).getFullYear();
  const thisYear = new Date().getFullYear();
  return (
    <Link href={`/matches/${match.id}`}>
      <div className="relative p-5 rounded-2xl bg-card border border-border card-hover cursor-pointer">
        <button
          onClick={(e) => { e.preventDefault(); onToggleFav(); }}
          className="absolute top-3 right-3 p-1 z-10"
          title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        >
          <Star className={`w-4 h-4 ${isFav ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
        </button>
        <div className="flex items-center justify-between mb-4 pr-6">
          <div className="flex items-center gap-2"><span className="text-lg">{match.sportIcon}</span><span className="text-xs text-muted-foreground font-medium">{match.leagueName}</span></div>
          <span className={statusClass[match.status] ?? "status-scheduled"}>
            {match.status === "live" ? (formatLiveStatus(match.status, match.statusLong, match.statusElapsed) || "진행중") : (statusLabel[match.status] ?? match.status)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex-1 text-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">{match.sportIcon}</div>
            <p className="text-sm font-semibold line-clamp-1">{match.homeTeam}</p>
            <p className="text-xs text-muted-foreground">홈</p>
          </div>
          <div className="text-center px-2">
            {(match.status === "finished" || match.status === "live") && match.homeScore !== null ? (
              <div className={`text-xl font-black flex items-center gap-1.5 ${match.status === "live" ? "animate-pulse" : ""}`}>
                <span className={match.homeScore > match.awayScore ? "text-red-500" : "text-foreground"}>{match.homeScore}</span>
                <span className="text-muted-foreground text-sm">:</span>
                <span className={match.awayScore > match.homeScore ? "text-red-500" : "text-foreground"}>{match.awayScore}</span>
              </div>
            ) : (
              <div className="text-xl font-bold text-muted-foreground">VS</div>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">{match.sportIcon}</div>
            <p className="text-sm font-semibold line-clamp-1">{match.awayTeam}</p>
            <p className="text-xs text-muted-foreground">원정</p>
          </div>
        </div>
        {match.odds && (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <div className="rounded-lg bg-accent/20 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">홈승</p>
              <p className="text-xs font-bold">{match.odds.homeWin ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-accent/20 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">무</p>
              <p className="text-xs font-bold">{match.odds.draw ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-accent/20 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">원정승</p>
              <p className="text-xs font-bold">{match.odds.awayWin ?? "-"}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(match.matchDate).toLocaleString("ko-KR", { year: matchYear !== thisYear ? "numeric" : undefined, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="flex items-center gap-1 text-primary"><Zap className="w-3 h-3" /><span>분석 보기</span></div>
        </div>
      </div>
    </Link>
  );
}

export default function Matches() {
  const search = useSearch();
  const { favorites } = useFavoriteSports();
  const { favorites: favMatches, toggle: toggleFavMatch, isFavorite: isFavMatch } = useFavoriteMatches();

  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // "live" = 실시간 탭(진행중인 경기만) / null = 오늘 중심 기본 보기(진행중→예정→오늘종료 순) / "YYYY-MM-DD" = 특정 날짜 전체
  const [selectedDate, setSelectedDate] = useState<string | "live" | null>("live");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sportId = params.get("sportId");
    if (sportId) setSelectedSport(Number(sportId));
    if (params.get("favorites") === "1") setFavoritesOnly(true);
  }, [search]);

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: leagues } = trpc.sport.leagues.useQuery({ sportId: selectedSport! }, { enabled: !!selectedSport });
  const todayStr0 = toDateStr(new Date());
  const isLiveTab = selectedDate === "live";
  const specificDate = selectedDate && selectedDate !== "live" ? selectedDate : null;
  const { data: matchesData, isLoading } = trpc.match.list.useQuery({
    sportId: favoritesOnly ? undefined : (selectedSport ?? undefined),
    leagueId: selectedLeague ?? undefined,
    // 실시간 탭: 진행중인 경기만 / 그 외: 상태 필터 드롭다운값 그대로
    status: isLiveTab ? "live" : (statusFilter === "all" ? undefined : statusFilter),
    limit: 100,
    date: specificDate ?? undefined,
    excludeOldFinished: !specificDate, // 특정 날짜 지정 안 했을 때만 "어제 이전 종료 경기" 숨김
    // 실시간 탭 또는 오늘 날짜를 볼 때는 진행중→예정→종료 순으로, 그 외 특정 날짜는 시간순이 더 자연스러움
    statusPriority: !specificDate || specificDate === todayStr0,
    sortDesc: false,
  }, { refetchInterval: isLiveTab ? 15000 : 30000 }); // 실시간 탭은 좀 더 자주 새로고침
  const allMatches = matchesData?.rows;
  const sportFiltered = favoritesOnly ? (allMatches ?? []).filter((m: any) => favorites.includes(m.sportId)) : allMatches;

  // 2026 신규: 리그별로 묶어서 표시 — 즐겨찾기한 경기가 있는 리그가 맨 위, 그 안에서도 즐겨찾기 경기가 먼저
  const groupedByLeague = useMemo(() => {
    const list = sportFiltered ?? [];
    const groups = new Map<string, any[]>();
    for (const m of list) {
      const key = m.leagueName ?? "기타";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    const entries = Array.from(groups.entries()).map(([leagueName, matches]) => {
      const sorted = [...matches].sort((a, b) => {
        const favA = favMatches.includes(a.id) ? 0 : 1;
        const favB = favMatches.includes(b.id) ? 0 : 1;
        if (favA !== favB) return favA - favB;
        return 0; // 원래 서버 정렬 순서(진행중→예정 등) 유지
      });
      const hasFav = sorted.some((m) => favMatches.includes(m.id));
      const earliestTime = Math.min(...matches.map((m: any) => new Date(m.matchDate).getTime()));
      return { leagueName, matches: sorted, hasFav, earliestTime, icon: matches[0]?.sportIcon };
    });
    entries.sort((a, b) => {
      if (a.hasFav !== b.hasFav) return a.hasFav ? -1 : 1;
      return a.earliestTime - b.earliestTime;
    });
    return entries;
  }, [sportFiltered, favMatches]);

  // 오늘 기준 -3일 ~ +3일 빠른 날짜 스트립 (와이즈토토/라이브스코어류 UX 참고)
  const dateStrip = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);
  const todayStr = todayStr0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryMenu />

      {/* 날짜 스트립 + 달력 */}
      <div className="border-b border-border bg-card/30">
        <div className="container px-4 md:px-6 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1 ${isLiveTab ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-accent"}`}
            onClick={() => setSelectedDate("live")}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveTab ? "bg-white animate-pulse" : "bg-red-500"}`} />실시간
          </button>
          {dateStrip.map((d) => {
            const ds = toDateStr(d);
            const isSelected = selectedDate === ds;
            const isToday = ds === todayStr;
            return (
              <button
                key={ds}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                onClick={() => setSelectedDate(ds)}
              >
                {isToday ? "오늘" : d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })}
              </button>
            );
          })}
          <div className="relative shrink-0 ml-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowDatePicker((v) => !v)}>
              <CalendarIcon className="w-4 h-4" />
            </Button>
            {showDatePicker && (
              <input
                type="date"
                autoFocus
                className="absolute right-0 top-9 z-30 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={specificDate ?? todayStr}
                onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
                onBlur={() => setShowDatePicker(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="container py-6 md:py-8 px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            {favoritesOnly && <Star className="w-5 h-5 fill-primary text-primary" />}
            {favoritesOnly ? "즐겨찾기 경기" : isLiveTab ? "실시간 경기" : specificDate ? `${new Date(specificDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 경기` : "경기 분석"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLiveTab ? "지금 진행 중인 경기만 표시됩니다" : specificDate ? "선택한 날짜의 경기입니다" : "진행중 → 예정 → 오늘 종료 순으로 표시됩니다"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <button className={`sport-chip ${!favoritesOnly && selectedSport === null ? "active" : ""}`} onClick={() => { setSelectedSport(null); setSelectedLeague(null); setFavoritesOnly(false); }}>전체</button>
            {favorites.length > 0 && (
              <button className={`sport-chip ${favoritesOnly ? "active" : ""}`} onClick={() => { setFavoritesOnly(true); setSelectedSport(null); setSelectedLeague(null); }}>
                <Star className="w-3 h-3 inline mr-1" />즐겨찾기 종목
              </button>
            )}
            {sports?.map((sport) => (
              <button key={sport.id} className={`sport-chip ${!favoritesOnly && selectedSport === sport.id ? "active" : ""}`} onClick={() => { setSelectedSport(sport.id); setSelectedLeague(null); setFavoritesOnly(false); }}>
                {sport.icon} {sport.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 md:ml-auto w-full md:w-auto">
            {selectedSport && leagues && leagues.length > 0 && !favoritesOnly && (
              <Select value={selectedLeague?.toString() ?? "all"} onValueChange={(v) => setSelectedLeague(v === "all" ? null : Number(v))}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="리그 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 리그</SelectItem>
                  {leagues.map((l) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!isLiveTab && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-sm"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="scheduled">예정</SelectItem>
                  <SelectItem value="live">진행중</SelectItem>
                  <SelectItem value="finished">종료</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : groupedByLeague.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{favoritesOnly ? "즐겨찾기한 종목에 예정된 경기가 없습니다." : isLiveTab ? "지금 진행 중인 경기가 없습니다." : "조건에 맞는 경기가 없습니다."}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByLeague.map((group) => (
              <div key={group.leagueName}>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <span className="text-lg">{group.icon}</span>
                  <h2 className="font-bold text-base">{group.leagueName}</h2>
                  <span className="text-xs text-muted-foreground">({group.matches.length}경기)</span>
                  {group.hasFav && <Star className="w-3.5 h-3.5 fill-primary text-primary ml-1" />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.matches.map((match: any) => (
                    <MatchCard key={match.id} match={match} isFav={isFavMatch(match.id)} onToggleFav={() => toggleFavMatch(match.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
