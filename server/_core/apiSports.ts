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
  return res.json();
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

// 특정 리그의 향후 경기 가져오기 (오늘부터 daysAhead일 이내, 기본 30일)
// "next=N" 방식 대신 명시적 날짜범위를 씀 — 시즌 표기 관례가 리그마다 달라서(유럽=8월시작연도, K리그=실제연도)
// 날짜범위 방식이 훨씬 예측 가능하고, 결과가 0건일 때 원인 파악이 쉬움
export async function fetchUpcomingFixtures(externalLeagueId: string, season: number, daysAhead: number = 30): Promise<ApiFootballFixture[]> {
  const from = new Date();
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

// 연동 상태 확인용 (관리자 화면 "API 연결 테스트" 버튼)
export async function testApiSportsConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const url = `${FOOTBALL_BASE}/status`;
    const data = await apiSportsGet<any>(url);
    return { ok: true, message: `연결 성공 — 오늘 사용한 요청 수: ${data.response?.requests?.current ?? "?"} / 하루 한도 ${data.response?.requests?.limit_day ?? "?"}회` };
  } catch (err: any) {
    return { ok: false, message: err.message ?? "알 수 없는 오류" };
  }
}
