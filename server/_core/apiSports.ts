import { ENV } from "./env";

// API-Sports.io 축구(API-Football v3) 연동
// 문서: https://www.api-football.com/documentation-v3
const FOOTBALL_BASE = "https://v3.football.api-sports.io";

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

export interface ApiFootballFixture {
  fixture: { id: number; date: string; venue: { name: string | null } | null; status: { short: string } };
  league: { id: number; name: string; country: string };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

// 특정 리그의 향후 N경기 가져오기 (externalLeagueId = API-Sports 리그 ID, 예: EPL=39)
export async function fetchUpcomingFixtures(externalLeagueId: string, season: number, next: number = 10): Promise<ApiFootballFixture[]> {
  const url = `${FOOTBALL_BASE}/fixtures?league=${externalLeagueId}&season=${season}&next=${next}`;
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
    return { ok: true, message: `연결 성공 — 오늘 남은 요청 수: ${data.response?.requests?.current ?? "?"}/${data.response?.requests?.limit_day ?? "?"}` };
  } catch (err: any) {
    return { ok: false, message: err.message ?? "알 수 없는 오류" };
  }
}
