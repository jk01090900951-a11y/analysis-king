import { eq, desc, and, or, inArray, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from "bcryptjs";
import { InsertUser, users, sports, leagues, matches, aiBots, botPicks, matchAnalysis, headToHead, systemSettings, botChampionHistory, pitcherStartHistory, playerAppearanceLog } from "../drizzle/schema";
import { ENV } from './_core/env';
import { fetchUpcomingFixtures } from './_core/apiSports';

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
  return db.select().from(sports).orderBy(sports.sortOrder);
}

export async function getLeaguesBySport(sportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leagues).where(and(eq(leagues.sportId, sportId), eq(leagues.isActive, true))).orderBy(leagues.sortOrder);
}

export async function getAllLeagues() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leagues).orderBy(leagues.sportId, leagues.sortOrder);
}

// ─── Matches ──────────────────────────────────────────────────────────────────
export async function getMatches(filters?: { leagueId?: number; sportId?: number; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
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
    status: matches.status,
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

  if (conditions.length > 0) {
    return (query as any).where(and(...conditions)).orderBy(matches.matchDate).limit(filters?.limit ?? 50);
  }
  return (query as any).orderBy(matches.matchDate).limit(filters?.limit ?? 50);
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
    status: matches.status,
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
  let created = 0, skipped = 0;
  for (const item of items) {
    const existing = await db.select().from(leagues).where(eq(leagues.externalLeagueId, item.externalLeagueId)).limit(1);
    if (existing.length > 0) { skipped++; continue; }
    await db.insert(leagues).values({
      sportId, name: item.name, country: item.country, logoUrl: item.logoUrl ?? null,
      externalLeagueId: item.externalLeagueId, tier: item.tier,
    });
    created++;
  }
  return { created, skipped };
}


export async function syncFootballFixturesForLeague(leagueId: number, season: number) {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스에 연결할 수 없습니다.");

  const leagueRows = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  const league = leagueRows[0];
  if (!league) throw new Error("리그를 찾을 수 없습니다.");
  if (!league.externalLeagueId) throw new Error("이 리그에 API-Sports 리그ID(externalLeagueId)가 설정되어 있지 않습니다. 종목·리그 관리에서 먼저 입력하세요.");

  // 유럽 리그 시즌은 "8월 시작 연도" 기준이라, 시즌 전환기(여름)엔 올해 시즌이 비어있을 수 있음
  // → 올해 시즌으로 먼저 시도하고, 결과가 0건이면 작년 시즌으로 자동 재시도
  let fixtures = await fetchUpcomingFixtures(league.externalLeagueId, season, 15);
  let usedSeason = season;
  if (fixtures.length === 0) {
    fixtures = await fetchUpcomingFixtures(league.externalLeagueId, season - 1, 15);
    usedSeason = season - 1;
  }
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
