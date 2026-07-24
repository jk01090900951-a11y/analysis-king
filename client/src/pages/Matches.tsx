import { useState, useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import Footer from "@/components/Footer";
import { useFavoriteSports } from "@/_core/hooks/useFavoriteSports";
import { Clock, Zap, Filter, Star, Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatLiveStatus } from "@/lib/matchStatus";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Matches() {
  const search = useSearch();
  const { favorites } = useFavoriteSports();

  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // null = "오늘 중심 기본 보기"(진행중→예정→오늘종료 순, 어제 이전 종료경기는 숨김)
  // 날짜지정 시 = 그 날짜의 모든 경기(상태 무관)를 달력으로 조회
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sportId = params.get("sportId");
    if (sportId) setSelectedSport(Number(sportId));
    if (params.get("favorites") === "1") setFavoritesOnly(true);
  }, [search]);

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: leagues } = trpc.sport.leagues.useQuery({ sportId: selectedSport! }, { enabled: !!selectedSport });
  const { data: matchesData, isLoading } = trpc.match.list.useQuery({
    sportId: favoritesOnly ? undefined : (selectedSport ?? undefined),
    leagueId: selectedLeague ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    date: selectedDate ?? undefined,
    excludeOldFinished: !selectedDate, // 날짜 지정 안 했을 때만 "어제 이전 종료 경기" 숨김
    statusPriority: !selectedDate, // 날짜 지정 시엔 그 날짜 안에서 시간순이 더 자연스러움
    sortDesc: false,
  }, { refetchInterval: 30000 }); // 라이브 스코어가 목록에서도 자동 갱신되도록
  const allMatches = matchesData?.rows;
  const matches = favoritesOnly ? (allMatches ?? []).filter((m: any) => favorites.includes(m.sportId)) : allMatches;

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
  const todayStr = toDateStr(new Date());

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryMenu />

      {/* 날짜 스트립 + 달력 */}
      <div className="border-b border-border bg-card/30">
        <div className="container px-4 md:px-6 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${!selectedDate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            onClick={() => setSelectedDate(null)}
          >
            실시간
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
                value={selectedDate ?? todayStr}
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
            {favoritesOnly ? "즐겨찾기 경기" : selectedDate ? `${new Date(selectedDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 경기` : "경기 분석"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedDate ? "선택한 날짜의 경기입니다" : "진행중 → 예정 순으로 표시됩니다 (지난 경기는 달력에서 확인)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <button className={`sport-chip ${!favoritesOnly && selectedSport === null ? "active" : ""}`} onClick={() => { setSelectedSport(null); setSelectedLeague(null); setFavoritesOnly(false); }}>전체</button>
            {favorites.length > 0 && (
              <button className={`sport-chip ${favoritesOnly ? "active" : ""}`} onClick={() => { setFavoritesOnly(true); setSelectedSport(null); setSelectedLeague(null); }}>
                <Star className="w-3 h-3 inline mr-1" />즐겨찾기
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="scheduled">예정</SelectItem>
                <SelectItem value="live">진행중</SelectItem>
                <SelectItem value="finished">종료</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : !matches || matches.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{favoritesOnly ? "즐겨찾기한 종목에 예정된 경기가 없습니다." : "조건에 맞는 경기가 없습니다."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match: any) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <div className="p-5 rounded-2xl bg-card border border-border card-hover cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
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
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(match.matchDate).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="flex items-center gap-1 text-primary"><Zap className="w-3 h-3" /><span>분석 보기</span></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
