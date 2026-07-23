import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import CategoryMenu from "@/components/CategoryMenu";
import Footer from "@/components/Footer";
import { useFavoriteSports } from "@/_core/hooks/useFavoriteSports";
import { Clock, Zap, Filter, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

export default function Matches() {
  const search = useSearch();
  const { favorites } = useFavoriteSports();

  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // URL 쿼리(?sportId=, ?favorites=1)로 진입 시 초기 필터 적용 (CategoryMenu/즐겨찾기 링크에서 옴)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sportId = params.get("sportId");
    if (sportId) setSelectedSport(Number(sportId));
    if (params.get("favorites") === "1") setFavoritesOnly(true);
  }, [search]);

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: leagues } = trpc.sport.leagues.useQuery({ sportId: selectedSport! }, { enabled: !!selectedSport });
  const { data: allMatches, isLoading } = trpc.match.list.useQuery({
    sportId: favoritesOnly ? undefined : (selectedSport ?? undefined),
    leagueId: selectedLeague ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  // 즐겨찾기 모드일 땐 서버 필터 대신 클라이언트에서 즐겨찾기한 종목만 걸러냄
  const matches = favoritesOnly ? (allMatches ?? []).filter((m: any) => favorites.includes(m.sportId)) : allMatches;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryMenu />
      <div className="container py-6 md:py-8 px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            {favoritesOnly && <Star className="w-5 h-5 fill-primary text-primary" />}
            {favoritesOnly ? "즐겨찾기 경기" : "경기 분석"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">분석가들의 경기 분석을 확인하세요</p>
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
                    <span className={statusClass[match.status] ?? "status-scheduled"}>{statusLabel[match.status] ?? match.status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex-1 text-center">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">{match.sportIcon}</div>
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
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl mx-auto mb-2">{match.sportIcon}</div>
                      <p className="text-sm font-semibold line-clamp-1">{match.awayTeam}</p>
                      <p className="text-xs text-muted-foreground">원정</p>
                    </div>
                  </div>
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
