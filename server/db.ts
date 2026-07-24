import { eq, desc, and, or, inArray, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from "bcryptjs";
import { InsertUser, users, sports, leagues, matches, aiBots, botPicks, matchAnalysis, headToHead, systemSettings, botChampionHistory, pitcherStartHistory, playerAppearanceLog } from "../drizzle/schema";
import { ENV } from './_core/env';
import { fetchUpcomingFixtures, fetchFixtureById, fetchUpcomingBaseballGames, fetchStandings, fetchFixtureStatistics, fetchFixtureEvents, fetchFixturePlayerStats, ApiFootballFixture } from './_core/apiSports';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Admin Auth (아이디/비밀번호, 카카오 폐지) ─────────────────────────────────
export async function ensureBootstrapAdmin(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) { console.warn("[Auth] DB에 연결할 수 없어 관리자 부트스트랩을 건너뜁니다."); return; }
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) return; // 이미 관리자 계정 있음
    if (!ENV.ADMIN_USERNAME || !ENV.ADMIN_PASSWORD) {
      console.warn("[Auth] 관리자 계정이 없고 .env의 ADMIN_USERNAME/ADMIN_PASSWORD도 비어있습니다 — 로그인 불가 상태입니다.");
      return;
    }
    const passwordHash = await bcrypt.hash(ENV.ADMIN_PASSWORD, 10);
    await db.insert(users).values({ username: ENV.ADMIN_USERNAME, passwordHash, name: "관리자" });
    console.log(`[Auth] 최초 관리자 계정이 생성되었습니다: ${ENV.ADMIN_USERNAME}`);
  } catch (error) {
    // DB가 아직 준비 안 됐거나 일시적 문제여도 서버 자체는 계속 켜져 있어야 함 (재시도는 재기동 시)
    console.error("[Auth] 관리자 부트스트랩 중 오류(서버는 계속 실행됩니다):", error);
  }
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

// 로그인 검증 — 성공 시 lastSignedIn 갱신 후 계정 반환, 실패 시 null
export async function verifyLogin(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  const db = await getDb();
  if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

// 관리자 화면에서 새 관리자 계정 추가 시 사용 (다중 관리자 지원)
export async function createAdmin(username: string, password: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ username, passwordHash, name: name ?? username });
}

export async function getAllSports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sports).where(eq(sports.isActive, true)).orderBy(sports.sortOrder);
}

export async function getAllSportsAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sports).where(eq(sports.isActive, true)).orderBy(sports.sortOrder);
}

export async function getLeaguesBySport(sportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leagues).where(and(eq(leagues.sportId, sportId), eq(leagues.isActive, true))).orderBy(leagues.sortOrder);
}

export async function getAllLeagues() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leagues).where(eq(leagues.isActive, true)).orderBy(leagues.sportId, leagues.sortOrder);
}

// ─── Matches ──────────────────────────────────────────────────────────────────
export async function getMatches(filters?: { leagueId?: number; sportId?: number; status?: string; limit?: number; offset?: number; todayOnly?: boolean; sortDesc?: boolean; date?: string; excludeOldFinished?: boolean; statusPriority?: boolean }) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  let query = db.select({
    id: matches.id,
    leagueId: matches.leagueId,
    homeTeam: matches.homeTeam,
    awayTeam: matches.awayTeam,
    homeTeamLogo: matches.homeTeamLogo,
    awayTeamLogo: matches.awayTeamLogo,
    matchDate: matches.matchDate,
    venue: matches.venue,
    homeScore: matches.homeScore,
    awayScore: matches.awayScore,
    result: matches.result,
    totalGoals: matches.totalGoals,
    overUnderLine: matches.overUnderLine,
    apiData: matches.apiData,
    odds: matches.odds,
    status: matches.status,
    statusElapsed: matches.statusElapsed,
    statusLong: matches.statusLong,
    settleStatus: matches.settleStatus,
    createdAt: matches.createdAt,
    leagueName: leagues.name,
    leagueCountry: leagues.country,
    sportId: leagues.sportId,
    sportName: sports.name,
    sportIcon: sports.icon,
    sportColor: sports.color,
  })
  .from(matches)
  .leftJoin(leagues, eq(matches.leagueId, leagues.id))
  .leftJoin(sports, eq(leagues.sportId, sports.id));

  const conditions = [];
  if (filters?.leagueId) conditions.push(eq(matches.leagueId, filters.leagueId));
  if (filters?.status) conditions.push(eq(matches.status, filters.status as any));
  if (filters?.sportId) conditions.push(eq(leagues.sportId, filters.sportId));
  if (filters?.todayOnly) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    conditions.push(gte(matches.matchDate, start));
    conditions.push(lte(matches.matchDate, end));
  }
  // 2026 신규: 달력에서 특정 날짜를 고른 경우 그 날짜(00:00~23:59)만 조회
  if (filters?.date) {
    const d = new Date(filters.date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    conditions.push(gte(matches.matchDate, start));
    conditions.push(lte(matches.matchDate, end));
  }
  // 2026 신규: 사용자 화면 기본 목록에서 "어제 이전에 끝났거나 취소된 경기"는 제외 (달력으로 따로 볼 수 있음)
  if (filters?.excludeOldFinished) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    conditions.push(or(sql`${matches.status} NOT IN ('finished', 'cancelled')`, gte(matches.matchDate, todayStart)));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  // 2026 신규: 사용자 화면 기본 정렬 = 진행중 → 예정 → 종료 순, 그 안에서는 날짜순
  // (예전엔 두 정렬 기준을 배열로 나눠 넘겨서 두번째 기준(날짜순)이 무시되는 버그가 있었음
  //  → 하나의 sql 구문으로 합쳐서 확실하게 "상태우선, 그 다음 날짜순"이 같이 적용되도록 수정)
  const orderExpr = filters?.statusPriority
    ? sql`CASE ${matches.status} WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END ASC, ${matches.matchDate} ASC`
    : (filters?.sortDesc ? sql`${matches.matchDate} DESC` : sql`${matches.matchDate} ASC`);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    whereClause
      ? (query as any).where(whereClause).orderBy(orderExpr).limit(limit).offset(offset)
      : (query as any).orderBy(orderExpr).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(matches)
      .leftJoin(leagues, eq(matches.leagueId, leagues.id))
      .where(whereClause),
  ]);
  const total = Number(countResult[0]?.count ?? 0);

  if (rows.length === 0) return { rows, total };
  const ids = rows.map((r: any) => r.id);
  const [analysisRows, pickRows] = await Promise.all([
    db.selectDistinct({ matchId: matchAnalysis.matchId }).from(matchAnalysis).where(inArray(matchAnalysis.matchId, ids)),
    db.selectDistinct({ matchId: botPicks.matchId }).from(botPicks).where(inArray(botPicks.matchId, ids)),
  ]);
  const analyzedSet = new Set(analysisRows.map((r: any) => r.matchId));
  const pickedSet = new Set(pickRows.map((r: any) => r.matchId));
  return { rows: rows.map((r: any) => ({ ...r, hasAnalysis: analyzedSet.has(r.id), hasPicks: pickedSet.has(r.id) })), total };
}

// 2026 신규: 페이지네이션과 무관하게 필터에 맞는 전체 matchId만 가볍게 조회 (여러 페이지 걸친 일괄선택용)
export async function getMatchIdsByFilter(filters?: { leagueId?: number; sportId?: number; status?: string; todayOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select({ id: matches.id }).from(matches).leftJoin(leagues, eq(matches.leagueId, leagues.id));
  const conditions = [];
  if (filters?.leagueId) conditions.push(eq(matches.leagueId, filters.leagueId));
  if (filters?.status) conditions.push(eq(matches.status, filters.status as any));
  if (filters?.sportId) conditions.push(eq(leagues.sportId, filters.sportId));
  if (filters?.todayOnly) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    conditions.push(gte(matches.matchDate, start));
    conditions.push(lte(matches.matchDate, end));
  }
  const rows = conditions.length > 0 ? await (query as any).where(and(...conditions)) : await query;
  return rows.map((r: any) => r.id as number);
}


export async function deleteMatchesBefore(beforeDate: Date) {
  const db = await getDb();
  if (!db) return { deleted: 0 };
  const targets = await db.select({ id: matches.id }).from(matches).where(lte(matches.matchDate, beforeDate));
  if (targets.length === 0) return { deleted: 0 };
  const ids = targets.map((t) => t.id);
  await db.delete(matchAnalysis).where(inArray(matchAnalysis.matchId, ids));
  await db.delete(botPicks).where(inArray(botPicks.matchId, ids));
  await db.delete(matches).where(inArray(matches.id, ids));
  return { deleted: ids.length };
}

export async function getMatchById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    id: matches.id,
    leagueId: matches.leagueId,
    homeTeam: matches.homeTeam,
    awayTeam: matches.awayTeam,
    homeTeamLogo: matches.homeTeamLogo,
    awayTeamLogo: matches.awayTeamLogo,
    matchDate: matches.matchDate,
    venue: matches.venue,
    homeScore: matches.homeScore,
    awayScore: matches.awayScore,
    result: matches.result,
    totalGoals: matches.totalGoals,
    overUnderLine: matches.overUnderLine,
    apiData: matches.apiData,
    externalId: matches.externalId,
    status: matches.status,
    statusElapsed: matches.statusElapsed,
    statusLong: matches.statusLong,
    settleStatus: matches.settleStatus,
    homeFormation: matches.homeFormation,
    awayFormation: matches.awayFormation,
    homeLineup: matches.homeLineup,
    awayLineup: matches.awayLineup,
    injuries: matches.injuries,
    odds: matches.odds,
    events: matches.events,
    matchStats: matches.matchStats,
    playerStats: matches.playerStats,
    homeTeamSeasonStats: matches.homeTeamSeasonStats,
    awayTeamSeasonStats: matches.awayTeamSeasonStats,
    homeCoach: matches.homeCoach,
    awayCoach: matches.awayCoach,
    homeCoachTrophies: matches.homeCoachTrophies,
    awayCoachTrophies: matches.awayCoachTrophies,
    homeTeamTransfers: matches.homeTeamTransfers,
    awayTeamTransfers: matches.awayTeamTransfers,
    leagueName: leagues.name,
    leagueCountry: leagues.country,
    sportId: leagues.sportId,
    sportName: sports.name,
    sportIcon: sports.icon,
    sportColor: sports.color,
  })
  .from(matches)
  .leftJoin(leagues, eq(matches.leagueId, leagues.id))
  .leftJoin(sports, eq(leagues.sportId, sports.id))
  .where(eq(matches.id, id))
  .limit(1);
  return result[0] ?? null;
}

// ─── AI Bots ──────────────────────────────────────────────────────────────────
export async function getAllBots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiBots).orderBy(aiBots.currentRank, aiBots.sortOrder);
}

export async function getBotById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiBots).where(eq(aiBots.id, id)).limit(1);
  return result[0] ?? null;
}

// ─── Bot Picks ────────────────────────────────────────────────────────────────
export async function getBotPicksForMatch(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: botPicks.id,
    botId: botPicks.botId,
    matchId: botPicks.matchId,
    pickType: botPicks.pickType,
    wdlPick: botPicks.wdlPick,
    wdlConfidence: botPicks.wdlConfidence,
    ouPick: botPicks.ouPick,
    ouLine: botPicks.ouLine,
    ouConfidence: botPicks.ouConfidence,
    reasoning: botPicks.reasoning,
    isCorrect: botPicks.isCorrect,
    isSettled: botPicks.isSettled,
    botName: aiBots.name,
    botAvatar: aiBots.avatar,
    botColor: aiBots.color,
    botStrategy: aiBots.strategy,
    botWinRate: aiBots.winRate,
    botRank: aiBots.currentRank,
  })
  .from(botPicks)
  .leftJoin(aiBots, eq(botPicks.botId, aiBots.id))
  .where(eq(botPicks.matchId, matchId))
  .orderBy(aiBots.currentRank);
}

// ─── User Predictions ─────────────────────────────────────────────────────────
export async function getMatchAnalyses(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: matchAnalysis.id,
    matchId: matchAnalysis.matchId,
    botId: matchAnalysis.botId,
    summary: matchAnalysis.summary,
    fullAnalysis: matchAnalysis.fullAnalysis,
    homeFormation: matchAnalysis.homeFormation,
    awayFormation: matchAnalysis.awayFormation,
    homeLineup: matchAnalysis.homeLineup,
    awayLineup: matchAnalysis.awayLineup,
    keyStats: matchAnalysis.keyStats,
    finalPick: matchAnalysis.finalPick,
    finalPickType: matchAnalysis.finalPickType,
    confidence: matchAnalysis.confidence,
    status: matchAnalysis.status,
    createdAt: matchAnalysis.createdAt,
    botName: aiBots.name,
    botAvatar: aiBots.avatar,
    botColor: aiBots.color,
    botStrategy: aiBots.strategy,
    botRank: aiBots.currentRank,
    botWinRate: aiBots.winRate,
    botTotalPicks: aiBots.totalPicks,
    botCorrectPicks: aiBots.correctPicks,
  })
  .from(matchAnalysis)
  .leftJoin(aiBots, eq(matchAnalysis.botId, aiBots.id))
  .where(eq(matchAnalysis.matchId, matchId))
  .orderBy(aiBots.currentRank);
}

export async function getHeadToHead(matchId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(headToHead).where(eq(headToHead.matchId, matchId)).limit(1);
  return result[0] ?? null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalAdmins: 0, totalMatches: 0, totalBots: 0, totalAnalyses: 0 };
  const [adminCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [matchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches);
  const [botCount] = await db.select({ count: sql<number>`count(*)` }).from(aiBots);
  const [analysisCount] = await db.select({ count: sql<number>`count(*)` }).from(matchAnalysis);
  return {
    totalAdmins: Number(adminCount?.count ?? 0),
    totalMatches: Number(matchCount?.count ?? 0),
    totalBots: Number(botCount?.count ?? 0),
    totalAnalyses: Number(analysisCount?.count ?? 0),
  };
}

// ─── Bot Profile (분석가 개인 프로필) ───────────────────────────────────────────
export async function getBotProfile(botId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiBots).where(eq(aiBots.id, botId)).limit(1);
  return result[0] ?? null;
}

// 분석가의 최근 10픽 결과
export async function getBotRecentPicks(botId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: botPicks.id,
    matchId: botPicks.matchId,
    pickType: botPicks.pickType,
    wdlPick: botPicks.wdlPick,
    wdlConfidence: botPicks.wdlConfidence,
    ouPick: botPicks.ouPick,
    ouConfidence: botPicks.ouConfidence,
    isCorrect: botPicks.isCorrect,
    isSettled: botPicks.isSettled,
    createdAt: botPicks.createdAt,
    homeTeam: matches.homeTeam,
    awayTeam: matches.awayTeam,
    matchDate: matches.matchDate,
    leagueName: leagues.name,
  })
  .from(botPicks)
  .leftJoin(matches, eq(botPicks.matchId, matches.id))
  .leftJoin(leagues, eq(matches.leagueId, leagues.id))
  .where(eq(botPicks.botId, botId))
  .orderBy(desc(botPicks.createdAt))
  .limit(10);
}

// 분석가의 종목별 적중률
export async function getBotStatsByCategory(botId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    leagueName: leagues.name,
    sportName: sports.name,
    totalPicks: sql<number>`COUNT(${botPicks.id})`,
    correctPicks: sql<number>`SUM(CASE WHEN ${botPicks.isCorrect} = true THEN 1 ELSE 0 END)`,
    winRate: sql<string>`CONCAT(ROUND(SUM(CASE WHEN ${botPicks.isCorrect} = true THEN 1 ELSE 0 END) * 100 / COUNT(${botPicks.id}), 1), '%')`,
  })
  .from(botPicks)
  .leftJoin(matches, eq(botPicks.matchId, matches.id))
  .leftJoin(leagues, eq(matches.leagueId, leagues.id))
  .leftJoin(sports, eq(leagues.sportId, sports.id))
  .where(and(eq(botPicks.botId, botId), eq(botPicks.isSettled, true)))
  .groupBy(leagues.id, sports.id);
}

// ─── User Ranking (사용자 예측 랭킹) ──────────────────────────────────────────
// 2026 삭제됨: getUserRanking (유저 랭킹 폐지 — 분석왕 V3.0 7절, 이제 봇 랭킹만 존재. bot.list의 currentRank 참고)
// 2026 삭제됨: getUserAnalysisList (유저 분석글 작성 폐지 — 4절 참고, matchAnalysis(AI 분석가 전용)로 대체)

// ─── Events (월간 이벤트) ────────────────────────────────────────────────────
// 나라별 리그 다중 선택 → 일괄 등록 (2026 신규 — 리그를 한 건씩 손으로 넣던 문제 해결)
export async function bulkImportLeagues(sportId: number, items: { externalLeagueId: string; name: string; country: string; logoUrl?: string | null; tier: "major" | "minor" }[]) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");
  let created = 0, skipped = 0, reactivated = 0;
  for (const item of items) {
    const existing = await db.select().from(leagues).where(eq(leagues.externalLeagueId, item.externalLeagueId)).limit(1);
    if (existing.length > 0) {
      if (!existing[0]!.isActive) {
        // 예전에 삭제(비활성화)했던 리그를 다시 가져오는 경우 → 새로 만들지 않고 재활성화
        await db.update(leagues).set({ isActive: true, tier: item.tier }).where(eq(leagues.id, existing[0]!.id));
        reactivated++;
      } else {
        skipped++;
      }
      continue;
    }
    await db.insert(leagues).values({
      sportId, name: item.name, country: item.country, logoUrl: item.logoUrl ?? null,
      externalLeagueId: item.externalLeagueId, tier: item.tier,
    });
    created++;
  }
  return { created, skipped, reactivated };
}

// ─── 경기 상태 자동 갱신 (2026 신규 — 예정→진행중→종료 자동 반영) ─────────────
// API-Football의 fixture.status.short 코드를 우리 상태값으로 매핑
function mapApiStatus(short: string): "scheduled" | "live" | "finished" | "cancelled" {
  if (["NS", "TBD"].includes(short)) return "scheduled";
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE", "INT"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled";
}

// 곧 시작했거나 진행 중일 가능성이 있는 경기들을 다시 조회해서 상태/스코어 갱신
// (매치 시작 30분 전 ~ 시작 후 4시간까지가 대상 — 그 외는 API 낭비라 건드리지 않음)
export async function refreshLiveMatchStatuses() {
  const db = await getDb();
  if (!db) return { checked: 0, updated: 0 };

  const now = new Date();
  // 2026 수정: 예전엔 "경기시작 후 4시간까지만" 확인해서, 그 안에 못 잡으면 영원히 "예정"으로 박제되는 버그가 있었음
  // → 과거 창을 30일로 넓혀서, 방치된 경기도 계속 재확인 대상에 포함시킴 (아직 scheduled/live인 것만 대상이라 낭비 적음)
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

  const candidates = await db.select().from(matches).where(and(
    inArray(matches.status, ["scheduled", "live"]),
    gte(matches.matchDate, windowStart),
    lte(matches.matchDate, windowEnd),
  ));

  let updated = 0;
  for (const m of candidates) {
    if (!m.externalId) continue;
    try {
      const fresh = await fetchFixtureById(m.externalId);
      if (!fresh) continue;
      const newStatus = mapApiStatus(fresh.fixture.status.short);
      const homeScore = fresh.goals.home;
      const awayScore = fresh.goals.away;
      const elapsed = fresh.fixture.status.elapsed;
      const statusLong = fresh.fixture.status.long;
      // 2026 수정: 상태(예정→진행중→종료)가 안 바뀌어도, 진행중이면 스코어/경기시간이 계속 바뀌므로 매번 갱신 대상에 포함
      const scoreChanged = homeScore !== m.homeScore || awayScore !== m.awayScore;
      const elapsedChanged = elapsed !== m.statusElapsed;
      if (newStatus !== m.status || scoreChanged || elapsedChanged) {
        await db.update(matches).set({
          status: newStatus, homeScore, awayScore, statusElapsed: elapsed, statusLong,
          result: homeScore != null && awayScore != null ? (homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw") : null,
          totalGoals: homeScore != null && awayScore != null ? homeScore + awayScore : null,
        }).where(eq(matches.id, m.id));
        updated++;

        // 2026 신규: 방금 "종료"로 바뀐 경기는 이벤트 타임라인 + 상세통계 + 선수개인기록도 같이 가져와 저장
        if (newStatus === "finished" && m.status !== "finished") {
          try {
            const [events, stats, playerStats] = await Promise.all([
              fetchFixtureEvents(m.externalId),
              fetchFixtureStatistics(m.externalId),
              fetchFixturePlayerStats(m.externalId),
            ]);
            await db.update(matches).set({ events, matchStats: stats, playerStats }).where(eq(matches.id, m.id));
          } catch (e) {
            console.warn(`[경기 종료 후 이벤트/통계 조회 실패] matchId=${m.id}:`, e);
          }
        }
      }
    } catch (e) {
      console.warn(`[경기상태 갱신 실패] matchId=${m.id}:`, e);
    }
  }
  return { checked: candidates.length, updated };
}


// 2026 신규: "부족하면 API에서 가져와 화면에만 잠깐 보여주고 버리기"가 아니라,
// 가져온 과거경기를 우리 DB에 실제로 저장해서 다음부터는 우리 데이터에서 바로 나오도록 함
// (리그가 아직 우리쪽에 등록 안 돼있으면(externalLeagueId 매칭 안됨) 저장은 건너뛰고 화면표시만 함)
export async function saveFetchedHistoricalFixture(fixture: {
  externalId: string; date: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  leagueExternalId: string; homeTeamLogo: string | null; awayTeamLogo: string | null; venue: string | null;
}) {
  const db = await getDb();
  if (!db) return { saved: false };

  const existing = await db.select({ id: matches.id }).from(matches).where(eq(matches.externalId, fixture.externalId)).limit(1);
  if (existing.length > 0) return { saved: false, reason: "이미 저장됨" };

  const leagueRows = await db.select().from(leagues).where(eq(leagues.externalLeagueId, fixture.leagueExternalId)).limit(1);
  const league = leagueRows[0];
  if (!league) return { saved: false, reason: "미등록 리그(자동생성 안 함)" };

  const homeScore = fixture.homeScore, awayScore = fixture.awayScore;
  await db.insert(matches).values({
    leagueId: league.id, homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam,
    homeTeamLogo: fixture.homeTeamLogo, awayTeamLogo: fixture.awayTeamLogo,
    matchDate: new Date(fixture.date), venue: fixture.venue,
    homeScore, awayScore,
    result: homeScore != null && awayScore != null ? (homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw") : null,
    totalGoals: homeScore != null && awayScore != null ? homeScore + awayScore : null,
    externalId: fixture.externalId, status: "finished",
  });
  return { saved: true };
}


export async function getStandings(leagueId: number, season: number) {
  const db = await getDb();
  if (!db) return null;
  const leagueRows = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  const league = leagueRows[0];
  if (!league) return null;
  if (!league.externalLeagueId) return { standings: null, error: "이 리그에 API-Sports 리그ID가 없어 순위표를 가져올 수 없습니다." };

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  if (league.standingsCache && league.standingsUpdatedAt && league.standingsUpdatedAt > sixHoursAgo) {
    return { standings: league.standingsCache, updatedAt: league.standingsUpdatedAt };
  }

  try {
    const fresh = await fetchStandings(league.externalLeagueId, season);
    await db.update(leagues).set({ standingsCache: fresh, standingsUpdatedAt: new Date() }).where(eq(leagues.id, leagueId));
    return { standings: fresh, updatedAt: new Date() };
  } catch (e) {
    console.warn(`[순위표 조회 실패] leagueId=${leagueId}:`, e);
    // 실패해도 예전 캐시라도 있으면 그거라도 반환
    return { standings: league.standingsCache ?? null, updatedAt: league.standingsUpdatedAt, error: "최신 순위표를 가져오지 못해 이전 캐시를 표시합니다." };
  }
}

export async function syncFootballFixturesForLeague(leagueId: number, season: number) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");

  const leagueRows = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  const league = leagueRows[0];
  if (!league) throw new Error("리그를 찾을 수 없습니다.");
  if (!league.externalLeagueId) throw new Error("이 리그에 API-Sports 리그ID(externalLeagueId)가 설정되어 있지 않습니다. 종목·리그 관리에서 먼저 입력하세요.");

  // 시즌 표기 관례가 리그마다 다름(유럽=8월시작연도, K리그·MLS=실제연도) → 올해→작년 순 시도
  // + 2024를 마지막 안전망으로 추가 (API-Sports 무료 플랜은 2022~2024 시즌만 지원 — 유료 전환 전 파이프라인 검증용)
  // 2024 검증 시에는 날짜범위도 2024년 내부(9월경, 대부분 리그 시즌 중)로 맞춰야 실제로 걸림
  let fixtures: ApiFootballFixture[] = [];
  let usedSeason = season;
  let lastError: Error | null = null;
  const attempts: { s: number; ref: Date }[] = [
    { s: season, ref: new Date() },
    { s: season - 1, ref: new Date() },
    { s: 2024, ref: new Date("2024-09-01") },
  ];
  for (const { s, ref } of attempts) {
    try {
      fixtures = await fetchUpcomingFixtures(league.externalLeagueId, s, 30, ref);
      usedSeason = s;
      if (fixtures.length > 0) break;
    } catch (err) {
      lastError = err as Error;
    }
  }
  if (fixtures.length === 0 && lastError) throw lastError;
  let created = 0, skipped = 0;

  for (const f of fixtures) {
    const externalId = String(f.fixture.id);
    const existing = await db.select().from(matches).where(eq(matches.externalId, externalId)).limit(1);
    if (existing.length > 0) { skipped++; continue; }

    await db.insert(matches).values({
      leagueId: league.id,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      homeTeamLogo: f.teams.home.logo,
      awayTeamLogo: f.teams.away.logo,
      matchDate: new Date(f.fixture.date),
      venue: f.fixture.venue?.name ?? null,
      externalId,
      apiData: f as unknown as Record<string, unknown>,
      status: "scheduled",
    });
    created++;
  }

  return { created, skipped, total: fixtures.length, usedSeason };
}

// 야구(KBO/MLB/NPB 공통) 경기 동기화 — 축구와 동일한 패턴, API-Baseball 응답 구조에 맞춰 필드만 다르게 매핑
export async function syncBaseballGamesForLeague(leagueId: number, season: number) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");

  const leagueRows = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  const league = leagueRows[0];
  if (!league) throw new Error("리그를 찾을 수 없습니다.");
  if (!league.externalLeagueId) throw new Error("이 리그에 API-Sports 리그ID가 설정되어 있지 않습니다. 종목·리그 관리에서 먼저 입력하세요.");

  // KBO/MLB/NPB 전부 실제 연도를 시즌으로 씀(유럽축구처럼 8월시작연도 아님) → 올해 우선, 2024 안전망
  const attempts = [season, season - 1, 2024];
  let games: Awaited<ReturnType<typeof fetchUpcomingBaseballGames>> = [];
  let usedSeason = season;
  let lastError: Error | null = null;
  const ref2024 = new Date("2024-06-01"); // KBO/MLB/NPB 시즌 한창인 시점
  for (const s of attempts) {
    try {
      games = await fetchUpcomingBaseballGames(league.externalLeagueId, s, 30, s === 2024 ? ref2024 : new Date());
      usedSeason = s;
      if (games.length > 0) break;
    } catch (err) {
      lastError = err as Error;
    }
  }
  if (games.length === 0 && lastError) throw lastError;

  let created = 0, skipped = 0;
  for (const g of games) {
    const externalId = String(g.id);
    const existing = await db.select().from(matches).where(eq(matches.externalId, externalId)).limit(1);
    if (existing.length > 0) { skipped++; continue; }

    await db.insert(matches).values({
      leagueId: league.id,
      homeTeam: g.teams.home.name,
      awayTeam: g.teams.away.name,
      homeTeamLogo: g.teams.home.logo,
      awayTeamLogo: g.teams.away.logo,
      matchDate: new Date(g.date),
      externalId,
      apiData: g as unknown as Record<string, unknown>,
      status: "scheduled",
    });
    created++;
  }
  return { created, skipped, total: games.length, usedSeason };
}


interface PitcherBoxScore {
  playerName: string;
  teamName: string;
  role: "starter" | "reliever";
  inningsPitched: number;
  pitchCount?: number;
  earnedRuns?: number;
  strikeouts?: number;
}

export async function recordPitcherStarts(matchId: number, matchDate: Date, pitchers: PitcherBoxScore[]) {
  const db = await getDb();
  if (!db) return;

  for (const p of pitchers) {
    const prev = await db.select().from(pitcherStartHistory)
      .where(eq(pitcherStartHistory.playerName, p.playerName))
      .orderBy(desc(pitcherStartHistory.startDate))
      .limit(1);

    const restDaysBeforeThis = prev[0]
      ? Math.round((matchDate.getTime() - new Date(prev[0].startDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let fatigueScore = 0;
    // 임계값은 system_settings에서 조회 (코드 수정 없이 관리자가 조건 추가/조정 가능하도록)
    const settingKeys = ["fatigue.heavy_pitch_count", "fatigue.heavy_innings", "fatigue.light_pitch_count", "fatigue.light_innings", "fatigue.reliever_min_rest_days"];
    const settingRows = await db.select().from(systemSettings).where(inArray(systemSettings.key, settingKeys));
    const setting = (key: string, fallback: number) => Number(settingRows.find(s => s.key === key)?.value ?? fallback);

    const heavyPitchCount = setting("fatigue.heavy_pitch_count", 90);
    const heavyInnings = setting("fatigue.heavy_innings", 7);
    const lightPitchCount = setting("fatigue.light_pitch_count", 70);
    const lightInnings = setting("fatigue.light_innings", 5);
    const relieverMinRestDays = setting("fatigue.reliever_min_rest_days", 2);

    const heavyLoad = (p.pitchCount != null ? p.pitchCount >= heavyPitchCount : false) || p.inningsPitched >= heavyInnings;
    const lightLoad = (p.pitchCount != null ? p.pitchCount < lightPitchCount : false) && p.inningsPitched < lightInnings;
    if (heavyLoad) fatigueScore = -2;
    else if (lightLoad) fatigueScore = 2;

    let restPenalty = 0;
    if (p.role === "reliever" && restDaysBeforeThis !== null && restDaysBeforeThis < relieverMinRestDays) restPenalty = -1;

    // 세이버메트릭스 "타순 3회전 페널티" — 선발투수가 6이닝 이상 던지면 타순을 3번째 상대했을 가능성 높음
    const thirdTimeThroughRisk = p.role === "starter" && p.inningsPitched >= 6;

    await db.insert(pitcherStartHistory).values({
      matchId,
      playerName: p.playerName,
      teamName: p.teamName,
      role: p.role,
      startDate: matchDate,
      inningsPitched: String(p.inningsPitched),
      pitchCount: p.pitchCount ?? null,
      earnedRuns: p.earnedRuns ?? null,
      strikeouts: p.strikeouts ?? null,
      restDaysBeforeThis,
      thirdTimeThroughRisk,
      fatigueScore,
      restPenalty,
    });
  }
}

// 야구: 다음 경기 분석 시, 예상 선발투수의 "직전 등판 피로도 점수" 조회 (봇 프롬프트에 주입)
export async function getPitcherFatigueScore(playerName: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pitcherStartHistory)
    .where(eq(pitcherStartHistory.playerName, playerName))
    .orderBy(desc(pitcherStartHistory.startDate))
    .limit(1);
  if (!rows[0]) return null;
  return {
    totalScore: rows[0].fatigueScore + rows[0].restPenalty,
    inningsPitched: rows[0].inningsPitched,
    pitchCount: rows[0].pitchCount,
    restDaysBeforeThis: rows[0].restDaysBeforeThis,
  };
}

// 축구: 팀의 최근 경기 밀집도 — 새 테이블 없이 기존 matches 테이블만으로 계산
export async function getTeamFixtureCongestion(teamName: string, asOfDate: Date) {
  const db = await getDb();
  if (!db) return { gamesLast7Days: 0, gamesLast14Days: 0, competitionsActive: 0, isBackToBack: false, daysSinceLastGame: null as number | null };

  const since14 = new Date(asOfDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  const since7 = new Date(asOfDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recent = await db.select({ matchDate: matches.matchDate, leagueId: matches.leagueId })
    .from(matches)
    .where(and(
      or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
      eq(matches.status, "finished"),
      gte(matches.matchDate, since14),
      lte(matches.matchDate, asOfDate),
    ))
    .orderBy(desc(matches.matchDate));

  const gamesLast14Days = recent.length;
  const gamesLast7Days = recent.filter(m => new Date(m.matchDate) >= since7).length;
  const competitionsActive = new Set(recent.map(m => m.leagueId)).size;

  // 2026 신규: 백투백(연속일 경기) 감지 — 농구/하키에서 특히 중요한 신호
  const daysSinceLastGame = recent[0]
    ? Math.round((asOfDate.getTime() - new Date(recent[0].matchDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isBackToBack = daysSinceLastGame !== null && daysSinceLastGame <= 1;

  return { gamesLast7Days, gamesLast14Days, competitionsActive, isBackToBack, daysSinceLastGame };
}
// 활용: gamesLast7Days >= 3 또는 isBackToBack=true 면 "밀집 일정" 신호, competitionsActive >= 2 면
// "동시 대회 출전"으로 로테이션(주전 휴식) 가능성이 높다고 판단 → 봇 프롬프트에 주입
// 종목 공통 사용 가능 (야구/축구/농구/배구/하키 전부 teamName 기준으로 동일하게 계산됨)

// 종목 공통: 팀의 최근 폼을 5/10/20경기 3단 구간으로 분석 (스포츠 분석 방법론 공통 컨센서스 반영)
export async function getTeamFormMultiWindow(teamName: string, asOfDate: Date) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ homeTeam: matches.homeTeam, awayTeam: matches.awayTeam, result: matches.result, matchDate: matches.matchDate })
    .from(matches)
    .where(and(
      or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName)),
      eq(matches.status, "finished"),
      lte(matches.matchDate, asOfDate),
    ))
    .orderBy(desc(matches.matchDate))
    .limit(20);

  const windowStats = (games: typeof rows) => {
    let wins = 0, draws = 0, losses = 0;
    for (const g of games) {
      const isHome = g.homeTeam === teamName;
      const won = (isHome && g.result === "home") || (!isHome && g.result === "away");
      const drew = g.result === "draw";
      if (won) wins++; else if (drew) draws++; else losses++;
    }
    return { games: games.length, wins, draws, losses, winRate: games.length ? Math.round((wins / games.length) * 100) : 0 };
  };

  return {
    last5: windowStats(rows.slice(0, 5)),
    last10: windowStats(rows.slice(0, 10)),
    last20: windowStats(rows.slice(0, 20)),
  };
}
// 활용: last5 승률은 높은데 last20 승률이 낮으면 "일시적 반등" 가능성, 반대로 last5만 나쁘면
// "슬럼프이나 장기적으로는 강팀" 식으로 해석 가능 → 프롬프트에 세 구간을 나란히 주입

// 2026 신규: 팀의 "홈경기 전체" 또는 "원정경기 전체" 성적 (특정 상대와 무관, 시즌 전체 기준)
// side="home" → 이 팀이 홈팀으로 뛴 경기만 집계 / side="away" → 원정팀으로 뛴 경기만 집계
export async function getTeamHomeAwayRecord(teamName: string, side: "home" | "away", asOfDate: Date, limit: number = 20) {
  const db = await getDb();
  if (!db) return { games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 };
  const condition = side === "home" ? eq(matches.homeTeam, teamName) : eq(matches.awayTeam, teamName);
  const rows = await db.select({ result: matches.result })
    .from(matches)
    .where(and(condition, eq(matches.status, "finished"), lte(matches.matchDate, asOfDate)))
    .orderBy(desc(matches.matchDate))
    .limit(limit);

  let wins = 0, draws = 0, losses = 0;
  for (const r of rows) {
    const won = (side === "home" && r.result === "home") || (side === "away" && r.result === "away");
    const drew = r.result === "draw";
    if (won) wins++; else if (drew) draws++; else losses++;
  }
  return { games: rows.length, wins, draws, losses, winRate: rows.length ? Math.round((wins / rows.length) * 100) : 0 };
}

// 2026 신규: 팀의 최근 경기를 "리스트"로 반환 (아래 splitH2hByVenue와 달리 집계가 아닌 개별 경기 행)
// side: "all"=전체, "home"=이 팀이 홈일 때만, "away"=이 팀이 원정일 때만
export async function getTeamRecentGamesList(teamName: string, side: "all" | "home" | "away", asOfDate: Date, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  const venueCond = side === "home" ? eq(matches.homeTeam, teamName) : side === "away" ? eq(matches.awayTeam, teamName) : or(eq(matches.homeTeam, teamName), eq(matches.awayTeam, teamName));
  const rows = await db.select({
    id: matches.id, matchDate: matches.matchDate, homeTeam: matches.homeTeam, awayTeam: matches.awayTeam,
    homeScore: matches.homeScore, awayScore: matches.awayScore, result: matches.result, leagueName: leagues.name,
  })
    .from(matches)
    .leftJoin(leagues, eq(matches.leagueId, leagues.id))
    .where(and(venueCond as any, eq(matches.status, "finished"), lte(matches.matchDate, asOfDate)))
    .orderBy(desc(matches.matchDate))
    .limit(limit);

  return rows.map((r) => {
    const isHome = r.homeTeam === teamName;
    const opponent = isHome ? r.awayTeam : r.homeTeam;
    const teamScore = isHome ? r.homeScore : r.awayScore;
    const oppScore = isHome ? r.awayScore : r.homeScore;
    const outcome: "win" | "draw" | "loss" | null =
      r.result == null ? null : r.result === "draw" ? "draw" : (isHome && r.result === "home") || (!isHome && r.result === "away") ? "win" : "loss";
    return { id: r.id, date: r.matchDate, isHome, opponent, teamScore, oppScore, outcome, leagueName: r.leagueName };
  });
}

// 2026 신규: 두 팀 간 상대전적을 "홈에서 만났을 때"/"원정에서 만났을 때"로 분리 (headToHead.records JSON을 그대로 재사용)
export function splitH2hByVenue(records: { homeTeam: string; awayTeam: string; result: string | null }[], teamName: string) {
  const asHome = records.filter((r) => r.homeTeam === teamName);
  const asAway = records.filter((r) => r.awayTeam === teamName);
  const tally = (games: typeof records, isHomePerspective: boolean) => {
    let wins = 0, draws = 0, losses = 0;
    for (const g of games) {
      const won = (isHomePerspective && g.result === "home") || (!isHomePerspective && g.result === "away");
      const drew = g.result === "draw";
      if (won) wins++; else if (drew) draws++; else losses++;
    }
    return { games: games.length, wins, draws, losses };
  };
  return { asHome: tally(asHome, true), asAway: tally(asAway, false) };
}


// playerAppearanceLog는 축구용으로 만들었지만 팀스포츠 전반에 범용으로 재사용 가능
export async function getPlayerRecentWorkload(playerName: string, teamName: string, recentGames: number = 5) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(playerAppearanceLog)
    .where(and(eq(playerAppearanceLog.playerName, playerName), eq(playerAppearanceLog.teamName, teamName)))
    .orderBy(desc(playerAppearanceLog.matchDate))
    .limit(recentGames);
  if (rows.length === 0) return null;
  const totalMinutes = rows.reduce((sum, r) => sum + (r.minutesPlayed ?? 0), 0);
  return { sampleSize: rows.length, totalMinutes, avgMinutes: Math.round(totalMinutes / rows.length) };
}
// 활용: 농구 주전이 최근 5경기 평균 38분+ 뛰었으면 "고부하" 신호로 프롬프트에 주입 가능
// (임계값은 system_settings에 "fatigue.basketball_heavy_minutes" 식으로 추가해서 조정 가능)

// 축구: 경기 정산 시 라인업(선발/교체) 출전 기록 적재 (로테이션 신호 감지용 누적)
export async function recordPlayerAppearances(matchId: number, matchDate: Date, appearances: { teamName: string; playerName: string; isStarter: boolean; minutesPlayed?: number }[]) {
  const db = await getDb();
  if (!db) return;
  for (const a of appearances) {
    await db.insert(playerAppearanceLog).values({
      matchId, matchDate, teamName: a.teamName, playerName: a.playerName,
      isStarter: a.isStarter, minutesPlayed: a.minutesPlayed ?? null,
    });
  }
}

// 축구: 특정 선수의 최근 N경기 선발 출전 비율 (로테이션 여부 판단 기준선)
export async function getPlayerStartRate(playerName: string, teamName: string, recentGames: number = 10) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(playerAppearanceLog)
    .where(and(eq(playerAppearanceLog.playerName, playerName), eq(playerAppearanceLog.teamName, teamName)))
    .orderBy(desc(playerAppearanceLog.matchDate))
    .limit(recentGames);
  if (rows.length === 0) return null;
  const starts = rows.filter(r => r.isStarter).length;
  return { sampleSize: rows.length, startRate: starts / rows.length };
}
// 활용: 평소 startRate가 0.8인 선수가 오늘 라인업(matchAnalysis.homeLineup/awayLineup)에
// 없다면 "로테이션 또는 부상" 신호로 간주 가능
