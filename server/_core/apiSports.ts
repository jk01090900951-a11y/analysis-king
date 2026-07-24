import { ENV } from "./env";

// API-Sports.io 종목별 서브도메인 (같은 회사, 같은 키로 5개 종목 전부 사용 가능)
// 종목 추가는 이 객체에 한 줄만 추가하면 됩니다 (SPORT_BASE에 없는 종목은 리그가져오기 기능이 비활성화됨)
const SPORT_BASE: Record<string, string> = {
  "축구": "https://v3.football.api-sports.io",
  "야구": "https://v1.baseball.api-sports.io",
  "농구": "https://v1.basketball.api-sports.io",
  "배구": "https://v1.volleyball.api-sports.io",
  "아이스하키": "https://v1.hockey.api-sports.io",
};

export const SUPPORTED_SPORTS = Object.keys(SPORT_BASE);

async function apiSportsGet<T = any>(url: string): Promise<T> {
  if (!ENV.API_SPORTS_KEY) throw new Error("API_SPORTS_KEY가 설정되지 않았습니다 (.env 확인)");
  const res = await fetch(url, {
    headers: { "x-apisports-key": ENV.API_SPORTS_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API-Sports 요청 실패 (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  // API-Sports는 HTTP 200이어도 응답 안에 errors를 숨겨서 보내는 경우가 많음
  // (예: 무료 플랜 제한, 잘못된 파라미터 조합 등) — 이걸 그냥 지나치면 "0건"으로만 보임
  const errors = data?.errors;
  if (errors && (Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0)) {
    const detail = Array.isArray(errors) ? errors.join(", ") : Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(", ");
    throw new Error(`API-Sports 응답 경고: ${detail}`);
  }
  return data;
}

export interface FoundLeague {
  externalLeagueId: string;
  name: string;
  type: string | null; // League / Cup 등
  logoUrl: string | null;
  country: string;
}

// 나라 목록 조회 (드롭다운용 — 정확한 국가명 스펠링을 몰라도 되게)
export async function fetchCountries(sportName: string): Promise<{ name: string; code: string | null; flag: string | null }[]> {
  const base = SPORT_BASE[sportName];
  if (!base) throw new Error(`지원하지 않는 종목입니다: ${sportName}`);
  const url = `${base}/countries`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  return (data.response ?? []).map((c: any) => ({ name: c.name, code: c.code ?? null, flag: c.flag ?? null }));
}

// 나라 이름으로 해당 종목의 모든 리그(1부/2부/컵대회 등) 검색
// ⚠️ 종목별로 API 응답 구조가 약간 다름(축구=league가 중첩객체, 나머지=id가 최상위) — 둘 다 방어적으로 처리
export async function searchLeaguesByCountry(sportName: string, country: string): Promise<FoundLeague[]> {
  const base = SPORT_BASE[sportName];
  if (!base) throw new Error(`지원하지 않는 종목입니다: ${sportName}`);

  const url = `${base}/leagues?country=${encodeURIComponent(country)}`;
  const data = await apiSportsGet<{ response: any[] }>(url);

  return (data.response ?? []).map((item: any): FoundLeague => {
    // 축구(v3): { league: { id, name, type, logo }, country: { name } }
    // 그 외(v1): { id, name, type, logo, country: { name } } (최상위 평탄 구조)
    const leagueObj = item.league ?? item;
    return {
      externalLeagueId: String(leagueObj.id),
      name: leagueObj.name,
      type: leagueObj.type ?? null,
      logoUrl: leagueObj.logo ?? null,
      country: item.country?.name ?? country,
    };
  });
}

export interface ApiFootballFixture {
  fixture: { id: number; date: string; venue: { name: string | null } | null; status: { short: string; long: string; elapsed: number | null } };
  league: { id: number; name: string; country: string };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

const FOOTBALL_BASE = SPORT_BASE["축구"];

// 특정 리그의 향후 경기 가져오기 (referenceDate부터 daysAhead일 이내, 기본값=오늘부터 30일)
// "next=N" 방식 대신 명시적 날짜범위를 씀 — 시즌 표기 관례가 리그마다 달라서(유럽=8월시작연도, K리그=실제연도)
// 날짜범위 방식이 훨씬 예측 가능하고, 결과가 0건일 때 원인 파악이 쉬움
export async function fetchUpcomingFixtures(externalLeagueId: string, season: number, daysAhead: number = 30, referenceDate: Date = new Date()): Promise<ApiFootballFixture[]> {
  const from = referenceDate;
  const to = new Date(from.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${FOOTBALL_BASE}/fixtures?league=${externalLeagueId}&season=${season}&from=${fmt(from)}&to=${fmt(to)}`;
  const data = await apiSportsGet<{ response: ApiFootballFixture[] }>(url);
  return data.response ?? [];
}

// 특정 리그의 오늘 날짜 경기 가져오기
export async function fetchFixturesByDate(externalLeagueId: string, season: number, date: string): Promise<ApiFootballFixture[]> {
  const url = `${FOOTBALL_BASE}/fixtures?league=${externalLeagueId}&season=${season}&date=${date}`;
  const data = await apiSportsGet<{ response: ApiFootballFixture[] }>(url);
  return data.response ?? [];
}

// 특정 경기 결과 재조회 (정산용 — 점수 확정 여부 확인)
export async function fetchFixtureById(fixtureId: string): Promise<ApiFootballFixture | null> {
  const url = `${FOOTBALL_BASE}/fixtures?id=${fixtureId}`;
  const data = await apiSportsGet<{ response: ApiFootballFixture[] }>(url);
  return data.response?.[0] ?? null;
}

// 연동 상태 확인용 (관리자 화면 "API 연결 테스트" 버튼) — 종목별로 쿼터가 별도라 종목 지정 필요
export async function testApiSportsConnection(sportName: string = "축구"): Promise<{ ok: boolean; message: string }> {
  try {
    const base = SPORT_BASE[sportName];
    if (!base) throw new Error(`지원하지 않는 종목입니다: ${sportName}`);
    const url = `${base}/status`;
    const data = await apiSportsGet<any>(url);
    const sub = data.response?.subscription?.plan ?? "무료";
    return { ok: true, message: `[${sportName}] 연결 성공 (${sub} 플랜) — 오늘 사용한 요청 수: ${data.response?.requests?.current ?? "?"} / 하루 한도 ${data.response?.requests?.limit_day ?? "?"}회` };
  } catch (err: any) {
    return { ok: false, message: err.message ?? "알 수 없는 오류" };
  }
}

// ─── 야구 (API-Baseball — KBO/MLB/NPB 공통) ────────────────────────────────
// ⚠️ 축구(API-Football)와 응답 필드명이 다를 수 있습니다. 실제 응답을 한 번 테스트해서
//    필드명이 다르면(예: teams 대신 home/away 최상위) 아래 인터페이스만 조정하면 됩니다.
const BASEBALL_BASE = SPORT_BASE["야구"];

export interface ApiBaseballGame {
  id: number;
  date: string;
  status: { short: string; long: string };
  league: { id: number; name: string; country?: string };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  scores: {
    home: { total: number | null };
    away: { total: number | null };
  };
}

export async function fetchUpcomingBaseballGames(externalLeagueId: string, season: number, daysAhead: number = 30, referenceDate: Date = new Date()): Promise<ApiBaseballGame[]> {
  const from = referenceDate;
  const to = new Date(from.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  // API-Baseball은 날짜범위 파라미터 지원 여부가 불확실해 우선 date 단건 방식 대신 league+season만으로 넓게 조회 후 앱단에서 날짜 필터링
  const url = `${BASEBALL_BASE}/games?league=${externalLeagueId}&season=${season}`;
  const data = await apiSportsGet<{ response: ApiBaseballGame[] }>(url);
  const all = data.response ?? [];
  return all.filter((g) => {
    const d = new Date(g.date);
    return d >= from && d <= to;
  });
}

export async function fetchBaseballGameById(gameId: string): Promise<ApiBaseballGame | null> {
  const url = `${BASEBALL_BASE}/games?id=${gameId}`;
  const data = await apiSportsGet<{ response: ApiBaseballGame[] }>(url);
  return data.response?.[0] ?? null;
}



// 배당률 (베팅 유도 목적이 아니라 "시장이 어느 쪽을 우세하게 보는지" 참고 정보로만 사용)
export interface OddsInfo {
  bookmaker: string;
  homeWin: string | null;
  draw: string | null;
  awayWin: string | null;
  over: string | null;
  under: string | null;
}
// ─── 리그 순위표 ────────────────────────────────────────────────────────────
export interface StandingRow {
  rank: number; team: string; teamLogo: string | null;
  points: number; played: number; win: number; draw: number; lose: number;
  goalsFor: number; goalsAgainst: number; form: string | null;
}
export async function fetchStandings(leagueExternalId: string, season: number): Promise<StandingRow[]> {
  const url = `${FOOTBALL_BASE}/standings?league=${leagueExternalId}&season=${season}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const table = data.response?.[0]?.league?.standings?.[0] ?? [];
  return table.map((r: any) => ({
    rank: r.rank, team: r.team?.name ?? "", teamLogo: r.team?.logo ?? null,
    points: r.points, played: r.all?.played ?? 0, win: r.all?.win ?? 0, draw: r.all?.draw ?? 0, lose: r.all?.lose ?? 0,
    goalsFor: r.all?.goals?.for ?? 0, goalsAgainst: r.all?.goals?.against ?? 0, form: r.form ?? null,
  }));
}

// ─── 완료 경기 상세통계 (슈팅/점유율/코너킥 등) ─────────────────────────────
export interface FixtureStatEntry { team: string; shotsTotal: number | null; shotsOnGoal: number | null; possession: string | null; corners: number | null; fouls: number | null; yellowCards: number | null; redCards: number | null; }
export async function fetchFixtureStatistics(fixtureId: string): Promise<FixtureStatEntry[]> {
  const url = `${FOOTBALL_BASE}/fixtures/statistics?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const findStat = (stats: any[], type: string) => stats?.find((s: any) => s.type === type)?.value ?? null;
  return (data.response ?? []).map((r: any) => ({
    team: r.team?.name ?? "",
    shotsTotal: findStat(r.statistics, "Total Shots"),
    shotsOnGoal: findStat(r.statistics, "Shots on Goal"),
    possession: findStat(r.statistics, "Ball Possession"),
    corners: findStat(r.statistics, "Corner Kicks"),
    fouls: findStat(r.statistics, "Fouls"),
    yellowCards: findStat(r.statistics, "Yellow Cards"),
    redCards: findStat(r.statistics, "Red Cards"),
  }));
}

// ─── 경기 중 이벤트 (골/카드 타임라인) ───────────────────────────────────────
export interface FixtureEvent { minute: number; type: string; detail: string; team: string; player: string | null; assist: string | null; }
export async function fetchFixtureEvents(fixtureId: string): Promise<FixtureEvent[]> {
  const url = `${FOOTBALL_BASE}/fixtures/events?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  return (data.response ?? []).map((e: any) => ({
    minute: e.time?.elapsed ?? 0, type: e.type ?? "", detail: e.detail ?? "",
    team: e.team?.name ?? "", player: e.player?.name ?? null, assist: e.assist?.name ?? null,
  }));
}

// ─── 팀 시즌 통계 (득점/실점 평균, 클린시트 등) ─────────────────────────────
export interface TeamSeasonStats { goalsForAvg: string | null; goalsAgainstAvg: string | null; cleanSheets: number | null; failedToScore: number | null; wins: number | null; draws: number | null; loses: number | null; }
export async function fetchTeamStatistics(teamId: number, leagueExternalId: string, season: number): Promise<TeamSeasonStats | null> {
  const url = `${FOOTBALL_BASE}/teams/statistics?team=${teamId}&league=${leagueExternalId}&season=${season}`;
  const data = await apiSportsGet<{ response: any }>(url);
  const r = data.response;
  if (!r) return null;
  return {
    goalsForAvg: r.goals?.for?.average?.total ?? null,
    goalsAgainstAvg: r.goals?.against?.average?.total ?? null,
    cleanSheets: (r.clean_sheet?.home ?? 0) + (r.clean_sheet?.away ?? 0),
    failedToScore: (r.failed_to_score?.home ?? 0) + (r.failed_to_score?.away ?? 0),
    wins: r.fixtures?.wins?.total ?? null, draws: r.fixtures?.draws?.total ?? null, loses: r.fixtures?.loses?.total ?? null,
  };
}

// ─── 선수 개인 경기기록 (슈팅/패스/파울/평점 등) ────────────────────────────
export interface PlayerMatchStat {
  team: string; name: string; position: string | null; rating: string | null;
  minutes: number | null; goals: number | null; assists: number | null;
  shotsTotal: number | null; shotsOn: number | null; passesTotal: number | null; passAccuracy: string | null;
  tackles: number | null; duelsWon: number | null; fouls: number | null; yellowCards: number | null; redCards: number | null;
}
export async function fetchFixturePlayerStats(fixtureId: string): Promise<PlayerMatchStat[]> {
  const url = `${FOOTBALL_BASE}/fixtures/players?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const result: PlayerMatchStat[] = [];
  for (const teamBlock of data.response ?? []) {
    const teamName = teamBlock.team?.name ?? "";
    for (const p of teamBlock.players ?? []) {
      const s = p.statistics?.[0];
      if (!s) continue;
      result.push({
        team: teamName, name: p.player?.name ?? "", position: s.games?.position ?? null, rating: s.games?.rating ?? null,
        minutes: s.games?.minutes ?? null, goals: s.goals?.total ?? null, assists: s.goals?.assists ?? null,
        shotsTotal: s.shots?.total ?? null, shotsOn: s.shots?.on ?? null,
        passesTotal: s.passes?.total ?? null, passAccuracy: s.passes?.accuracy ?? null,
        tackles: s.tackles?.total ?? null, duelsWon: s.duels?.won ?? null,
        fouls: s.fouls?.committed ?? null, yellowCards: s.cards?.yellow ?? null, redCards: s.cards?.red ?? null,
      });
    }
  }
  return result;
}

// ─── 감독 정보 ───────────────────────────────────────────────────────────────
export interface CoachInfo { id: number; name: string; age: number | null; nationality: string | null; photo: string | null; career: { team: string; start: string | null; end: string | null }[]; }
export async function fetchTeamCoach(teamId: number): Promise<CoachInfo | null> {
  const url = `${FOOTBALL_BASE}/coachs?team=${teamId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const c = data.response?.[0];
  if (!c) return null;
  return {
    id: c.id, name: c.name ?? "", age: c.age ?? null, nationality: c.nationality ?? null, photo: c.photo ?? null,
    career: (c.career ?? []).map((k: any) => ({ team: k.team?.name ?? "", start: k.start ?? null, end: k.end ?? null })),
  };
}

// ─── 우승 기록 (감독 기준) ───────────────────────────────────────────────────
export interface TrophyInfo { league: string; country: string; season: string; place: string; }
export async function fetchCoachTrophies(coachId: number): Promise<TrophyInfo[]> {
  const url = `${FOOTBALL_BASE}/trophies?coach=${coachId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  return (data.response ?? []).map((t: any) => ({ league: t.league ?? "", country: t.country ?? "", season: t.season ?? "", place: t.place ?? "" }));
}

// ─── 이적 기록 ───────────────────────────────────────────────────────────────
export interface TransferInfo { playerName: string; date: string | null; fromTeam: string; toTeam: string; type: string | null; }
export async function fetchTeamTransfers(teamId: number, limit: number = 10): Promise<TransferInfo[]> {
  const url = `${FOOTBALL_BASE}/transfers?team=${teamId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const result: TransferInfo[] = [];
  for (const p of data.response ?? []) {
    for (const t of p.transfers ?? []) {
      result.push({ playerName: p.player?.name ?? "", date: t.date ?? null, fromTeam: t.teams?.out?.name ?? "", toTeam: t.teams?.in?.name ?? "", type: t.type ?? null });
    }
  }
  return result.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, limit);
}

export async function fetchOdds(fixtureId: string): Promise<OddsInfo | null> {
  const url = `${FOOTBALL_BASE}/odds?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  const first = data.response?.[0];
  if (!first) return null;
  const bookmaker = first.bookmakers?.[0];
  if (!bookmaker) return null;
  const matchWinnerBet = bookmaker.bets?.find((b: any) => b.name === "Match Winner");
  const goalsBet = bookmaker.bets?.find((b: any) => b.name === "Goals Over/Under");
  const findVal = (bet: any, label: string) => bet?.values?.find((v: any) => v.value === label)?.odd ?? null;
  return {
    bookmaker: bookmaker.name ?? "알수없음",
    homeWin: findVal(matchWinnerBet, "Home"),
    draw: findVal(matchWinnerBet, "Draw"),
    awayWin: findVal(matchWinnerBet, "Away"),
    over: goalsBet?.values?.[0]?.odd ?? null,
    under: goalsBet?.values?.[1]?.odd ?? null,
  };
}

export interface RealHeadToHead {
  date: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  result: "home" | "draw" | "away" | null; league: string;
}

// 팀의 최근 경기 (우리 DB 누적과 무관하게 API에서 직접 — 이제 막 추적 시작한 리그도 바로 데이터가 나오게)
export interface TeamRecentFixture {
  externalId: string; date: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  league: string; leagueExternalId: string; homeTeamLogo: string | null; awayTeamLogo: string | null; venue: string | null;
}
export async function fetchTeamRecentFixtures(teamId: number, last: number = 10): Promise<TeamRecentFixture[]> {
  const url = `${FOOTBALL_BASE}/fixtures?team=${teamId}&last=${last}&status=FT`;
  const data = await apiSportsGet<{ response: ApiFootballFixture[] }>(url);
  return (data.response ?? []).map((f) => ({
    externalId: String(f.fixture.id), date: f.fixture.date, homeTeam: f.teams.home.name, awayTeam: f.teams.away.name,
    homeScore: f.goals.home, awayScore: f.goals.away, league: f.league.name, leagueExternalId: String(f.league.id),
    homeTeamLogo: f.teams.home.logo ?? null, awayTeamLogo: f.teams.away.logo ?? null, venue: f.fixture.venue?.name ?? null,
  }));
}

// 실제 두 팀 간 최근 맞대결 기록 (팀ID 필요 — match.apiData의 teams.home.id/teams.away.id에서 추출)
export async function fetchHeadToHead(team1Id: number, team2Id: number, last: number = 10): Promise<RealHeadToHead[]> {
  const url = `${FOOTBALL_BASE}/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=${last}`;
  const data = await apiSportsGet<{ response: ApiFootballFixture[] }>(url);
  return (data.response ?? []).map((f) => {
    const hs = f.goals.home, as = f.goals.away;
    const result: "home" | "draw" | "away" | null = hs == null || as == null ? null : hs > as ? "home" : hs < as ? "away" : "draw";
    return { date: f.fixture.date.slice(0, 10), homeTeam: f.teams.home.name, awayTeam: f.teams.away.name, homeScore: hs, awayScore: as, result, league: f.league.name };
  });
}

// 경기별 부상자 명단 (fixtureId = API-Sports 경기ID, 즉 matches.externalId)
export async function fetchInjuries(fixtureId: string): Promise<{ team: string; player: string; type: string; reason: string }[]> {
  const url = `${FOOTBALL_BASE}/injuries?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  return (data.response ?? []).map((i: any) => ({
    team: i.team?.name ?? "", player: i.player?.name ?? "", type: i.player?.type ?? "", reason: i.player?.reason ?? "",
  }));
}

// 경기별 실제(또는 예상) 라인업/포메이션
export async function fetchLineups(fixtureId: string): Promise<{ team: string; formation: string | null; startXI: { name: string; position: string; number: number }[] }[]> {
  const url = `${FOOTBALL_BASE}/fixtures/lineups?fixture=${fixtureId}`;
  const data = await apiSportsGet<{ response: any[] }>(url);
  return (data.response ?? []).map((l: any) => ({
    team: l.team?.name ?? "",
    formation: l.formation ?? null,
    startXI: (l.startXI ?? []).map((p: any) => ({ name: p.player?.name ?? "", position: p.player?.pos ?? "", number: p.player?.number ?? 0 })),
  }));
}
