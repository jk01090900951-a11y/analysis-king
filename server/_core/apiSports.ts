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
  fixture: { id: number; date: string; venue: { name: string | null } | null; status: { short: string } };
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



export interface RealHeadToHead {
  date: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  result: "home" | "draw" | "away" | null; league: string;
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
