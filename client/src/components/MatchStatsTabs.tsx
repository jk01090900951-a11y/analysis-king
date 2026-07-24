import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, AlertCircle, TrendingUp, ListOrdered, Goal } from "lucide-react";

interface Props {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
}

interface GameRow {
  id: number;
  date: string;
  isHome: boolean;
  opponent: string;
  teamScore: number | null;
  oppScore: number | null;
  outcome: "win" | "draw" | "loss" | null;
  leagueName: string | null;
}

const outcomeBadge: Record<string, { label: string; className: string }> = {
  win: { label: "승", className: "bg-green-500/20 text-green-400" },
  draw: { label: "무", className: "bg-yellow-500/20 text-yellow-400" },
  loss: { label: "패", className: "bg-red-500/20 text-red-400" },
};

function GameList({ teamName, games }: { teamName: string; games: GameRow[] }) {
  if (games.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">최근 경기 기록이 없습니다.</p>;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">마지막 경기: {teamName}</p>
      <div className="space-y-1">
        {games.map((g) => (
          <div key={g.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/20 text-xs">
            <span className="text-muted-foreground shrink-0 w-16">{new Date(g.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>
            <span className="text-muted-foreground shrink-0 w-10 truncate">{g.leagueName}</span>
            <span className={`flex-1 truncate ${!g.isHome ? "" : "font-medium"}`}>{teamName}</span>
            <span className="font-bold text-foreground shrink-0 w-10 text-center">{g.teamScore ?? "-"} : {g.oppScore ?? "-"}</span>
            <span className="flex-1 truncate text-right">{g.opponent}</span>
            {g.outcome && (
              <span className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${outcomeBadge[g.outcome].className}`}>
                {outcomeBadge[g.outcome].label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MatchStatsTabs({ matchId, homeTeam, awayTeam }: Props) {
  const { data, isLoading } = trpc.analysis.matchStats.useQuery({ matchId });
  const [h2hFilter, setH2hFilter] = useState<"all" | "home" | "away">("all");
  // 2026 수정: 이 훅이 원래 아래 조기 return(로딩중/데이터없음) 이후에 있어서
  // 렌더링마다 훅 호출 개수가 달라져 "React error #310"이 나던 버그 — 최상단으로 이동
  const { data: standingsData } = trpc.sport.standings.useQuery(
    { leagueId: (data?.leagueId as number) ?? 0 },
    { enabled: !!data?.leagueId }
  );

  if (isLoading) return <div className="h-40 rounded-xl bg-accent/20 animate-pulse" />;
  if (!data) return null;

  const { h2h, recentGames, lineup, injuries, odds: rawOdds, venue: rawVenue, events, fixtureStats, playerStats, homeTeamSeasonStats, awayTeamSeasonStats, homeCoach, awayCoach, homeCoachTrophies, awayCoachTrophies, homeTeamTransfers, awayTeamTransfers } = data;
  const h2hRecords = (h2h?.records as { date: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; result: string; league?: string }[] | null) ?? [];
  const venue = rawVenue as string | null;
  const odds = rawOdds as { bookmaker: string; homeWin: string | null; draw: string | null; awayWin: string | null } | null;
  const injuriesList = (injuries as { team: string; player: string; type: string; reason: string }[] | null) ?? [];
  const homeLineup = (lineup?.homeLineup as { name: string; position: string; number: number }[] | null) ?? [];
  const awayLineup = (lineup?.awayLineup as { name: string; position: string; number: number }[] | null) ?? [];
  const eventsList = (events as { minute: number; type: string; detail: string; team: string; player: string | null }[] | null) ?? [];
  const statsList = (fixtureStats as { team: string; shotsTotal: number | null; shotsOnGoal: number | null; possession: string | null; corners: number | null; fouls: number | null; yellowCards: number | null; redCards: number | null }[] | null) ?? [];
  const playersList = (playerStats as { team: string; name: string; position: string | null; rating: string | null; minutes: number | null; goals: number | null; assists: number | null; shotsTotal: number | null; passesTotal: number | null }[] | null) ?? [];
  const homeSeasonStats = homeTeamSeasonStats as { goalsForAvg: string | null; goalsAgainstAvg: string | null; cleanSheets: number | null; wins: number | null; draws: number | null; loses: number | null } | null;
  const awaySeasonStats = awayTeamSeasonStats as { goalsForAvg: string | null; goalsAgainstAvg: string | null; cleanSheets: number | null; wins: number | null; draws: number | null; loses: number | null } | null;
  const hCoach = homeCoach as { name: string; age: number | null; nationality: string | null } | null;
  const aCoach = awayCoach as { name: string; age: number | null; nationality: string | null } | null;
  const hTrophies = (homeCoachTrophies as { league: string; country: string; season: string; place: string }[] | null) ?? [];
  const aTrophies = (awayCoachTrophies as { league: string; country: string; season: string; place: string }[] | null) ?? [];
  const hTransfers = (homeTeamTransfers as { playerName: string; date: string | null; fromTeam: string; toTeam: string; type: string | null }[] | null) ?? [];
  const aTransfers = (awayTeamTransfers as { playerName: string; date: string | null; fromTeam: string; toTeam: string; type: string | null }[] | null) ?? [];

  return (
    <Tabs defaultValue="h2h" className="w-full">
      <TabsList className="w-full grid grid-cols-6 mb-3">
        <TabsTrigger value="h2h" className="text-xs">H2H</TabsTrigger>
        <TabsTrigger value="standings" className="text-xs">순위표</TabsTrigger>
        <TabsTrigger value="lineup" className="text-xs">라인업</TabsTrigger>
        <TabsTrigger value="players" className="text-xs">선수기록</TabsTrigger>
        <TabsTrigger value="team" className="text-xs">팀정보</TabsTrigger>
        <TabsTrigger value="info" className="text-xs">경기정보</TabsTrigger>
      </TabsList>

      {/* H2H: 상단(탭별 개별 홈/원정 전적, 상대 무관) + 하단(실제 맞대결 표, 탭과 무관하게 항상 고정) */}
      <TabsContent value="h2h">
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setH2hFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-bold ${h2hFilter === "all" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>전체</button>
          <button onClick={() => setH2hFilter("home")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${h2hFilter === "home" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>{homeTeam} · 홈</button>
          <button onClick={() => setH2hFilter("away")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${h2hFilter === "away" ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground"}`}>{awayTeam} · 원정</button>
        </div>

        {/* 상단: 선택한 탭에 따라 그 팀의 개별 최근경기(상대 무관) */}
        {h2hFilter === "all" && (
          <div className="space-y-4">
            <GameList teamName={homeTeam} games={recentGames.homeTeamAllGames as GameRow[]} />
            <div className="border-t border-border/30 pt-3">
              <GameList teamName={awayTeam} games={recentGames.awayTeamAllGames as GameRow[]} />
            </div>
          </div>
        )}
        {h2hFilter === "home" && <GameList teamName={homeTeam} games={recentGames.homeTeamHomeGames as GameRow[]} />}
        {h2hFilter === "away" && <GameList teamName={awayTeam} games={recentGames.awayTeamAwayGames as GameRow[]} />}

        {/* 하단: 실제 두 팀 맞대결 표 — 탭 선택과 무관하게 항상 전체 그대로 고정 표시 */}
        {h2hRecords.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-bold text-primary">최근 상대전적</p>
              <p className="text-xs text-muted-foreground">{homeTeam} {h2h!.homeWins}승 {h2h!.draws}무 {h2h!.awayWins}패 {awayTeam}</p>
            </div>
            <div className="space-y-1">
              {h2hRecords.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/20 text-xs">
                  <span className="text-muted-foreground shrink-0 w-16">{new Date(r.date).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                  <span className="text-muted-foreground shrink-0 w-10 truncate">{r.league ?? ""}</span>
                  <span className="flex-1 truncate text-right">{r.homeTeam}</span>
                  <span className="font-bold text-foreground shrink-0 w-12 text-center">{r.homeScore} : {r.awayScore}</span>
                  <span className="flex-1 truncate">{r.awayTeam}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* 순위표 */}
      <TabsContent value="standings">
        {!standingsData?.standings || (standingsData.standings as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-1.5"><ListOrdered className="w-4 h-4" />순위표 데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left py-1.5 pl-1">#</th>
                  <th className="text-left py-1.5">팀</th>
                  <th className="text-center py-1.5">경기</th>
                  <th className="text-center py-1.5">승</th>
                  <th className="text-center py-1.5">무</th>
                  <th className="text-center py-1.5">패</th>
                  <th className="text-center py-1.5">득실</th>
                  <th className="text-center py-1.5 pr-1">승점</th>
                </tr>
              </thead>
              <tbody>
                {(standingsData.standings as any[]).map((r) => (
                  <tr key={r.rank} className={`border-b border-border/10 ${r.team === homeTeam || r.team === awayTeam ? "bg-primary/10 font-medium" : ""}`}>
                    <td className="py-1.5 pl-1">{r.rank}</td>
                    <td className="py-1.5 truncate max-w-[100px]">{r.team}</td>
                    <td className="text-center py-1.5">{r.played}</td>
                    <td className="text-center py-1.5">{r.win}</td>
                    <td className="text-center py-1.5">{r.draw}</td>
                    <td className="text-center py-1.5">{r.lose}</td>
                    <td className="text-center py-1.5">{r.goalsFor - r.goalsAgainst}</td>
                    <td className="text-center py-1.5 pr-1 font-bold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* 선수 개인기록 (완료된 경기만) */}
      <TabsContent value="players">
        {playersList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">경기가 끝나야 선수 개인기록을 볼 수 있습니다.</p>
        ) : (
          <div className="space-y-4">
            {[homeTeam, awayTeam].map((team) => (
              <div key={team}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">{team}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left py-1 pl-1">선수</th>
                        <th className="text-center py-1">평점</th>
                        <th className="text-center py-1">득점</th>
                        <th className="text-center py-1">도움</th>
                        <th className="text-center py-1">슈팅</th>
                        <th className="text-center py-1 pr-1">패스</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playersList.filter((p) => p.team === team).map((p, i) => (
                        <tr key={i} className="border-b border-border/10">
                          <td className="py-1 pl-1 truncate max-w-[100px]">{p.name}</td>
                          <td className="text-center py-1">{p.rating ?? "-"}</td>
                          <td className="text-center py-1">{p.goals ?? 0}</td>
                          <td className="text-center py-1">{p.assists ?? 0}</td>
                          <td className="text-center py-1">{p.shotsTotal ?? 0}</td>
                          <td className="text-center py-1 pr-1">{p.passesTotal ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* 팀정보: 감독 + 우승기록 + 이적기록 */}
      <TabsContent value="team" className="space-y-4">
        {[{ team: homeTeam, coach: hCoach, trophies: hTrophies, transfers: hTransfers }, { team: awayTeam, coach: aCoach, trophies: aTrophies, transfers: aTransfers }].map((side) => (
          <div key={side.team} className="space-y-2">
            <p className="text-xs font-bold px-1">{side.team}</p>
            <div className="p-2 rounded-lg bg-accent/20 text-xs">
              <p className="text-muted-foreground mb-1">감독</p>
              {side.coach ? (
                <p>{side.coach.name} {side.coach.age ? `(${side.coach.age}세)` : ""} {side.coach.nationality ? `· ${side.coach.nationality}` : ""}</p>
              ) : (
                <p className="text-muted-foreground">정보 없음</p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-accent/20 text-xs">
              <p className="text-muted-foreground mb-1">감독 우승 기록</p>
              {side.trophies.length === 0 ? (
                <p className="text-muted-foreground">기록 없음</p>
              ) : (
                <div className="space-y-0.5">
                  {side.trophies.slice(0, 5).map((t, i) => (
                    <p key={i}>{t.season} {t.league} ({t.country}) — {t.place}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-accent/20 text-xs">
              <p className="text-muted-foreground mb-1">최근 이적 기록</p>
              {side.transfers.length === 0 ? (
                <p className="text-muted-foreground">기록 없음</p>
              ) : (
                <div className="space-y-0.5">
                  {side.transfers.slice(0, 5).map((t, i) => (
                    <p key={i} className="truncate">{t.date ?? "-"} · {t.playerName} ({t.fromTeam} → {t.toTeam})</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </TabsContent>

      {/* 경기 정보: 경기장 + 부상자 + 참고 배당률 + (종료시)이벤트/상세통계 */}
      <TabsContent value="info" className="space-y-4">
        {venue && (
          <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground shrink-0" />{venue}</div>
        )}
        {(homeSeasonStats || awaySeasonStats) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">팀 시즌 통계</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-accent/20">
                <p className="font-medium mb-1">{homeTeam}</p>
                <p className="text-muted-foreground">평균 득점 {homeSeasonStats?.goalsForAvg ?? "-"} · 실점 {homeSeasonStats?.goalsAgainstAvg ?? "-"}</p>
                <p className="text-muted-foreground">클린시트 {homeSeasonStats?.cleanSheets ?? "-"}회 · {homeSeasonStats?.wins ?? "-"}승{homeSeasonStats?.draws ?? "-"}무{homeSeasonStats?.loses ?? "-"}패</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/20">
                <p className="font-medium mb-1">{awayTeam}</p>
                <p className="text-muted-foreground">평균 득점 {awaySeasonStats?.goalsForAvg ?? "-"} · 실점 {awaySeasonStats?.goalsAgainstAvg ?? "-"}</p>
                <p className="text-muted-foreground">클린시트 {awaySeasonStats?.cleanSheets ?? "-"}회 · {awaySeasonStats?.wins ?? "-"}승{awaySeasonStats?.draws ?? "-"}무{awaySeasonStats?.loses ?? "-"}패</p>
              </div>
            </div>
          </div>
        )}
        {eventsList.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><Goal className="w-3.5 h-3.5" />경기 이벤트</p>
            <div className="space-y-1">
              {eventsList.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-accent/20">
                  <span className="text-muted-foreground w-8 shrink-0">{e.minute}'</span>
                  <span className="shrink-0">{e.type === "Goal" ? "⚽" : e.type === "Card" ? (e.detail?.includes("Red") ? "🟥" : "🟨") : "🔄"}</span>
                  <span className="flex-1 truncate">{e.player ?? e.detail}</span>
                  <span className="text-muted-foreground truncate">{e.team}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {statsList.length === 2 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">경기 상세통계</p>
            <div className="space-y-1.5 text-xs">
              {[
                { label: "점유율", home: statsList[0].possession, away: statsList[1].possession },
                { label: "슈팅", home: statsList[0].shotsTotal, away: statsList[1].shotsTotal },
                { label: "유효슈팅", home: statsList[0].shotsOnGoal, away: statsList[1].shotsOnGoal },
                { label: "코너킥", home: statsList[0].corners, away: statsList[1].corners },
                { label: "파울", home: statsList[0].fouls, away: statsList[1].fouls },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-10 text-right font-medium">{row.home ?? "-"}</span>
                  <span className="flex-1 text-center text-muted-foreground">{row.label}</span>
                  <span className="w-10 font-medium">{row.away ?? "-"}</span>
                </div>
              ))}
            </div>
          </div>
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
