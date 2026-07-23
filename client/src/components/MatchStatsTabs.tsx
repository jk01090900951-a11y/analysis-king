import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, AlertCircle, TrendingUp } from "lucide-react";

interface Props {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
}

function RecordBar({ wins, draws, losses, games }: { wins: number; draws: number; losses: number; games: number }) {
  if (games === 0) return <p className="text-xs text-muted-foreground">데이터 없음</p>;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-accent/30 mb-1.5">
        <div className="bg-green-500" style={{ width: `${(wins / games) * 100}%` }} />
        <div className="bg-muted-foreground/40" style={{ width: `${(draws / games) * 100}%` }} />
        <div className="bg-red-500/70" style={{ width: `${(losses / games) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{wins}승 {draws}무 {losses}패 ({games}경기 기준)</p>
    </div>
  );
}

export default function MatchStatsTabs({ matchId, homeTeam, awayTeam }: Props) {
  const { data, isLoading } = trpc.analysis.matchStats.useQuery({ matchId });

  if (isLoading) return <div className="h-40 rounded-xl bg-accent/20 animate-pulse" />;
  if (!data) return null;

  const { h2h, h2hSplit, homeTeamHomeRecord, homeTeamAwayRecord, awayTeamHomeRecord, awayTeamAwayRecord, lineup, injuries, odds: rawOdds, venue: rawVenue } = data;
  const venue = rawVenue as string | null;
  const odds = rawOdds as { bookmaker: string; homeWin: string | null; draw: string | null; awayWin: string | null } | null;
  const injuriesList = (injuries as { team: string; player: string; type: string; reason: string }[] | null) ?? [];
  const homeLineup = (lineup?.homeLineup as { name: string; position: string; number: number }[] | null) ?? [];
  const awayLineup = (lineup?.awayLineup as { name: string; position: string; number: number }[] | null) ?? [];

  return (
    <Tabs defaultValue="h2h" className="w-full">
      <TabsList className="w-full grid grid-cols-4 mb-3">
        <TabsTrigger value="h2h" className="text-xs">상대전적</TabsTrigger>
        <TabsTrigger value="team" className="text-xs">팀 기록</TabsTrigger>
        <TabsTrigger value="lineup" className="text-xs">라인업</TabsTrigger>
        <TabsTrigger value="info" className="text-xs">경기정보</TabsTrigger>
      </TabsList>

      {/* 상대전적: 전체 / 홈경기때 / 원정경기때 */}
      <TabsContent value="h2h" className="space-y-4">
        {!h2h ? (
          <p className="text-sm text-muted-foreground text-center py-6">상대전적 데이터가 아직 없습니다.</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">전체 맞대결 ({h2h.totalGames}경기)</p>
              <RecordBar wins={h2h.homeWins} draws={h2h.draws} losses={h2h.awayWins} games={h2h.totalGames} />
              <p className="text-xs text-muted-foreground mt-1">평균 {h2h.avgTotalGoals}골 · {homeTeam} 기준</p>
            </div>
            {h2hSplit && (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{homeTeam}가 <span className="text-primary">홈</span>에서 만났을 때</p>
                  <RecordBar wins={h2hSplit.asHome.wins} draws={h2hSplit.asHome.draws} losses={h2hSplit.asHome.losses} games={h2hSplit.asHome.games} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{homeTeam}가 <span className="text-primary">원정</span>에서 만났을 때</p>
                  <RecordBar wins={h2hSplit.asAway.wins} draws={h2hSplit.asAway.draws} losses={h2hSplit.asAway.losses} games={h2hSplit.asAway.games} />
                </div>
              </>
            )}
          </>
        )}
      </TabsContent>

      {/* 팀 기록: 이 상대와 무관한 시즌 전체 홈/원정 성적 */}
      <TabsContent value="team" className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{homeTeam} — 시즌 홈경기 전체</p>
          <RecordBar wins={homeTeamHomeRecord.wins} draws={homeTeamHomeRecord.draws} losses={homeTeamHomeRecord.losses} games={homeTeamHomeRecord.games} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{homeTeam} — 시즌 원정경기 전체</p>
          <RecordBar wins={homeTeamAwayRecord.wins} draws={homeTeamAwayRecord.draws} losses={homeTeamAwayRecord.losses} games={homeTeamAwayRecord.games} />
        </div>
        <div className="border-t border-border/30 pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{awayTeam} — 시즌 원정경기 전체</p>
          <RecordBar wins={awayTeamAwayRecord.wins} draws={awayTeamAwayRecord.draws} losses={awayTeamAwayRecord.losses} games={awayTeamAwayRecord.games} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{awayTeam} — 시즌 홈경기 전체</p>
          <RecordBar wins={awayTeamHomeRecord.wins} draws={awayTeamHomeRecord.draws} losses={awayTeamHomeRecord.losses} games={awayTeamHomeRecord.games} />
        </div>
      </TabsContent>

      {/* 라인업 (실제 API 데이터, 미발표 시 안내) */}
      <TabsContent value="lineup">
        {homeLineup.length === 0 && awayLineup.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-1.5"><Users className="w-4 h-4" />라인업이 아직 발표되지 않았습니다 (보통 킥오프 1시간 전 공개)</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{homeTeam} {lineup?.homeFormation ? `(${lineup.homeFormation})` : ""}</p>
              <div className="space-y-1">
                {homeLineup.map((p, i) => <div key={i} className="text-xs flex gap-2"><span className="text-muted-foreground w-5">{p.number}</span><span>{p.name}</span><span className="text-muted-foreground ml-auto">{p.position}</span></div>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{awayTeam} {lineup?.awayFormation ? `(${lineup.awayFormation})` : ""}</p>
              <div className="space-y-1">
                {awayLineup.map((p, i) => <div key={i} className="text-xs flex gap-2"><span className="text-muted-foreground w-5">{p.number}</span><span>{p.name}</span><span className="text-muted-foreground ml-auto">{p.position}</span></div>)}
              </div>
            </div>
          </div>
        )}
      </TabsContent>

      {/* 경기 정보: 경기장 + 부상자 + 참고 배당률 */}
      <TabsContent value="info" className="space-y-4">
        {venue && (
          <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground shrink-0" />{venue}</div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />부상자 명단</p>
          {injuriesList.length === 0 ? (
            <p className="text-xs text-muted-foreground">보고된 부상자가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {injuriesList.map((inj, i) => (
                <div key={i} className="text-xs flex justify-between p-2 rounded-lg bg-accent/20">
                  <span>{inj.team} — {inj.player}</span>
                  <span className="text-muted-foreground">{inj.type || inj.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {odds && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />시장 배당률 (참고용, {odds.bookmaker})</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-accent/20"><p className="text-xs text-muted-foreground">홈승</p><p className="font-bold text-sm">{odds.homeWin ?? "-"}</p></div>
              <div className="p-2 rounded-lg bg-accent/20"><p className="text-xs text-muted-foreground">무</p><p className="font-bold text-sm">{odds.draw ?? "-"}</p></div>
              <div className="p-2 rounded-lg bg-accent/20"><p className="text-xs text-muted-foreground">원정승</p><p className="font-bold text-sm">{odds.awayWin ?? "-"}</p></div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
