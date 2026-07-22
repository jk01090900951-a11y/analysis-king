import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Clock, Zap, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabel: Record<string, string> = { scheduled: "예정", live: "진행중", finished: "종료", cancelled: "취소" };
const statusClass: Record<string, string> = { scheduled: "status-scheduled", live: "status-live", finished: "status-finished", cancelled: "status-cancelled" };

export default function Matches() {
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: sports } = trpc.sport.list.useQuery();
  const { data: leagues } = trpc.sport.leagues.useQuery({ sportId: selectedSport! }, { enabled: !!selectedSport });
  const { data: matches, isLoading } = trpc.match.list.useQuery({
    sportId: selectedSport ?? undefined,
    leagueId: selectedLeague ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">경기 예측</h1>
          <p className="text-muted-foreground text-sm mt-1">스포츠전문분석 픽을 확인하고 예측에 참여하세요</p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <button className={`sport-chip ${selectedSport === null ? "active" : ""}`} onClick={() => { setSelectedSport(null); setSelectedLeague(null); }}>전체</button>
            {sports?.map((sport) => (
              <button key={sport.id} className={`sport-chip ${selectedSport === sport.id ? "active" : ""}`} onClick={() => { setSelectedSport(sport.id); setSelectedLeague(null); }}>
                {sport.icon} {sport.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            {selectedSport && leagues && leagues.length > 0 && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : matches?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>조건에 맞는 경기가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches?.map((match: any) => (
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
                    <div className="flex items-center gap-1 text-primary"><Zap className="w-3 h-3" /><span>스포츠전문분석 픽 보기</span></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
