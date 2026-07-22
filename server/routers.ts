import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, desc, gte, lte, sql, isNull } from "drizzle-orm";
import { getDb, verifyLogin, getAllUsers, createAdmin, getAdminStats, getAllSports, getAllSportsAdmin, getLeaguesBySport, getAllLeagues, getMatches, getMatchById, getAllBots, getBotById, getBotPicksForMatch, getMatchAnalyses, getHeadToHead, getBotProfile, getBotRecentPicks, getBotStatsByCategory, recordPitcherStarts, getPitcherFatigueScore, getTeamFixtureCongestion, recordPlayerAppearances, getPlayerStartRate, getPlayerRecentWorkload, getTeamFormMultiWindow, syncFootballFixturesForLeague, bulkImportLeagues } from "./db";
import { testApiSportsConnection, fetchCountries, searchLeaguesByCountry, SUPPORTED_SPORTS } from "./_core/apiSports";
import { users, sports, leagues, matches, aiBots, botPicks, matchAnalysis, headToHead, systemSettings, botChampionHistory } from "../drizzle/schema";
import { storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, adminProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";
// 2026 삭제된 import: getUserRanking, getUserAnalysisList (유저 분석글/랭킹 폐지), userAnalysis, adWatchLog 테이블
// 2026: 카카오 로그인 폐지로 upsertUser/getUserByOpenId 대신 아이디비번 인증 함수(verifyLogin 등) 사용

// ══════════════════════════════════════════════════════════════════════════
// API-Sports 원본 응답(apiData) → 우리 내부 형식 변환 어댑터
// ⚠️ TODO: 실제 API-Sports 응답 필드명 확인 후 파싱 로직 채우기
//    (야구: games/statistics 또는 유사 엔드포인트의 pitchers 배열,
//     축구: fixtures/lineups 엔드포인트의 startXI/substitutes 배열)
//    지금은 apiData가 있어도 빈 배열을 반환해 정산 자체는 항상 안전하게 통과됩니다.
// ══════════════════════════════════════════════════════════════════════════
function parsePitcherBoxScores(apiData: Record<string, unknown>): {
  playerName: string; teamName: string; role: "starter" | "reliever";
  inningsPitched: number; pitchCount?: number; earnedRuns?: number; strikeouts?: number;
}[] {
  // TODO: apiData.players 또는 apiData.statistics 등 실제 구조에 맞춰 매핑
  return [];
}

function parseLineupAppearances(apiData: Record<string, unknown>): {
  teamName: string; playerName: string; isStarter: boolean; minutesPlayed?: number;
}[] {
  // TODO: apiData.lineups?.[].startXI / substitutes 등 실제 구조에 맞춰 매핑
  return [];
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await verifyLogin(input.username, input.password);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "아이디 또는 비밀번호가 올바르지 않습니다." });
        const token = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, { expiresIn: "30d" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Sports ───────────────────────────────────────────────────────────────
  sport: router({
    list: publicProcedure.query(() => getAllSports()),
    listAdmin: adminProcedure.query(() => getAllSportsAdmin()),
    leagues: publicProcedure.input(z.object({ sportId: z.number() })).query(({ input }) => getLeaguesBySport(input.sportId)),
    allLeagues: adminProcedure.query(() => getAllLeagues()),

    create: adminProcedure
      .input(z.object({ name: z.string().min(1), nameEn: z.string().optional(), icon: z.string().optional(), color: z.string().optional(), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(sports).values(input);
        return { success: true };
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), nameEn: z.string().optional(), icon: z.string().optional(), color: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...rest } = input;
        await db.update(sports).set(rest).where(eq(sports.id, id));
        return { success: true };
      }),

    createLeague: adminProcedure
      .input(z.object({ sportId: z.number(), name: z.string().min(1), nameEn: z.string().optional(), country: z.string().optional(), logoUrl: z.string().optional(), tier: z.enum(["major", "minor"]).default("minor"), externalLeagueId: z.string().optional(), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.externalLeagueId) {
          const existing = await db.select().from(leagues).where(eq(leagues.externalLeagueId, input.externalLeagueId)).limit(1);
          if (existing.length > 0) {
            if (!existing[0]!.isActive) {
              await db.update(leagues).set({ isActive: true }).where(eq(leagues.id, existing[0]!.id));
              return { success: true, reactivated: true };
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: "이미 등록된 API-Sports 리그ID입니다." });
          }
        }
        await db.insert(leagues).values(input);
        return { success: true };
      }),
    updateLeague: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), country: z.string().optional(), logoUrl: z.string().optional(), tier: z.enum(["major", "minor"]).optional(), externalLeagueId: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...rest } = input;
        await db.update(leagues).set(rest).where(eq(leagues.id, id));
        return { success: true };
      }),
    // API-Sports 실제 연동 (2026 신규 — 축구 우선 구현)
    testApiSportsConnection: adminProcedure.mutation(() => testApiSportsConnection()),
    syncFootballFixtures: adminProcedure
      .input(z.object({ leagueId: z.number(), season: z.number().default(new Date().getFullYear()) }))
      .mutation(({ input }) => syncFootballFixturesForLeague(input.leagueId, input.season)),
    // 나라별 리그 대량 가져오기 (2026 신규)
    supportedSports: adminProcedure.query(() => SUPPORTED_SPORTS),
    countries: adminProcedure
      .input(z.object({ sportName: z.string() }))
      .query(({ input }) => fetchCountries(input.sportName)),
    searchLeagues: adminProcedure
      .input(z.object({ sportName: z.string(), country: z.string() }))
      .query(({ input }) => searchLeaguesByCountry(input.sportName, input.country)),
    bulkImportLeagues: adminProcedure
      .input(z.object({
        sportId: z.number(),
        items: z.array(z.object({
          externalLeagueId: z.string(), name: z.string(), country: z.string(),
          logoUrl: z.string().nullable().optional(), tier: z.enum(["major", "minor"]),
        })),
      }))
      .mutation(({ input }) => bulkImportLeagues(input.sportId, input.items)),
    deleteSport: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(sports).set({ isActive: false }).where(eq(sports.id, input.id));
        return { success: true };
      }),
    deleteLeague: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(leagues).set({ isActive: false }).where(eq(leagues.id, input.id));
        return { success: true };
      }),
  }),

  // ─── Matches ──────────────────────────────────────────────────────────────
  match: router({
    list: publicProcedure
      .input(z.object({ leagueId: z.number().optional(), sportId: z.number().optional(), status: z.string().optional(), limit: z.number().optional() }).optional())
      .query(({ input }) => getMatches(input ?? {})),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getMatchById(input.id)),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getMatchById(input.id)),

    create: adminProcedure
      .input(z.object({
        leagueId: z.number(),
        homeTeam: z.string().min(1),
        awayTeam: z.string().min(1),
        homeTeamLogo: z.string().optional(),
        awayTeamLogo: z.string().optional(),
        matchDate: z.string(),
        venue: z.string().optional(),
        overUnderLine: z.string().default("2.5"),
        status: z.enum(["scheduled", "live", "finished", "cancelled"]).default("scheduled"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { matchDate, ...rest } = input;
        await db.insert(matches).values({ ...rest, matchDate: new Date(matchDate) });
        return { success: true };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        homeTeam: z.string().optional(),
        awayTeam: z.string().optional(),
        matchDate: z.string().optional(),
        venue: z.string().optional(),
        overUnderLine: z.string().optional(),
        status: z.enum(["scheduled", "live", "finished", "cancelled"]).optional(),
        homeScore: z.number().optional(),
        awayScore: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, matchDate, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest };
        if (matchDate) updateData.matchDate = new Date(matchDate);
        await db.update(matches).set(updateData).where(eq(matches.id, id));
        return { success: true };
      }),

    // 결과 입력 및 포인트 정산
    settle: adminProcedure
      .input(z.object({
        matchId: z.number(),
        homeScore: z.number(),
        awayScore: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const match = await getMatchById(input.matchId);
        if (!match) throw new TRPCError({ code: "NOT_FOUND" });

        const { homeScore, awayScore } = input;
        const totalGoals = homeScore + awayScore;
        const result = homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";
        const ouLine = Number(match.overUnderLine ?? 2.5);
        const ouResult = totalGoals > ouLine ? "over" : "under";

        // 경기 결과 업데이트
        await db.update(matches).set({ homeScore, awayScore, result, totalGoals, status: "finished" }).where(eq(matches.id, input.matchId));

        // 2026 신규: 종목별 피로도 데이터 자동 누적 (외부 API 의존 최소화, match.apiData 원본에서 파싱)
        // TODO: parsePitcherBoxScores/parseLineupAppearances는 API-Sports 실제 응답 필드명에 맞춘
        //       어댑터 함수로 구현 필요 (아래는 자리만 잡아둔 상태 — apiData가 비어있으면 스킵됨)
        if (match.sportName?.includes("야구") && match.apiData) {
          const pitchers = parsePitcherBoxScores(match.apiData as Record<string, unknown>);
          if (pitchers.length > 0) await recordPitcherStarts(input.matchId, match.matchDate, pitchers);
        }
        if (match.sportName?.includes("축구") && match.apiData) {
          const appearances = parseLineupAppearances(match.apiData as Record<string, unknown>);
          if (appearances.length > 0) await recordPlayerAppearances(input.matchId, match.matchDate, appearances);
        }

        // 봇 픽 정산
        const allBotPicks = await db.select().from(botPicks).where(eq(botPicks.matchId, input.matchId));
        for (const pick of allBotPicks) {
          let isCorrect = false;
          if (pick.pickType === "win_draw_lose") isCorrect = pick.wdlPick === result;
          else if (pick.pickType === "under_over") isCorrect = pick.ouPick === ouResult;
          await db.update(botPicks).set({ isCorrect, isSettled: true }).where(eq(botPicks.id, pick.id));
        }

        // 봇 승률 업데이트
        const allBots = await db.select().from(aiBots);
        for (const bot of allBots) {
          const botPickList = await db.select().from(botPicks).where(eq(botPicks.botId, bot.id));
          const settled = botPickList.filter(p => p.isSettled);
          const correct = settled.filter(p => p.isCorrect);
          const winRate = settled.length > 0 ? ((correct.length / settled.length) * 100).toFixed(2) : "0.00";
          await db.update(aiBots).set({ totalPicks: settled.length, correctPicks: correct.length, winRate }).where(eq(aiBots.id, bot.id));
        }

        // 봇 연승 업데이트
        for (const bot of allBots) {
          const botPickList = await db.select().from(botPicks).where(eq(botPicks.botId, bot.id)).orderBy(desc(botPicks.createdAt));
          let currentStreak = 0;
          for (const pick of botPickList) {
            if (pick.isSettled && pick.isCorrect) {
              currentStreak++;
            } else {
              break;
            }
          }
          const newMaxStreak = Math.max(currentStreak, bot.maxStreak ?? 0);
          await db.update(aiBots).set({ currentStreak, maxStreak: newMaxStreak }).where(eq(aiBots.id, bot.id));
        }

        // 봇 순위 재계산 (승률 기준)
        const updatedBots = await db.select().from(aiBots).where(eq(aiBots.isActive, true));
        const sorted = [...updatedBots].sort((a, b) => Number(b.winRate) - Number(a.winRate));
        for (let i = 0; i < sorted.length; i++) {
          await db.update(aiBots).set({ currentRank: i + 1 }).where(eq(aiBots.id, sorted[i]!.id));
        }

        // 경기 정산 상태 갱신 (AdminSettle.tsx 표시용) — 2026: 개인 예측/포인트 정산 폐지, 봇 승률만 갱신
        await db.update(matches).set({
          settleStatus: "settled",
          settledAt: new Date(),
        }).where(eq(matches.id, input.matchId));

        return { success: true, result, ouResult };
      }),
  }),

  // ─── AI Bots ──────────────────────────────────────────────────────────────
  bot: router({
    list: publicProcedure.query(() => getAllBots()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getBotById(input.id)),
    picksForMatch: publicProcedure.input(z.object({ matchId: z.number() })).query(({ input }) => getBotPicksForMatch(input.matchId)),

    // AI 봇 픽 생성 (LLM 활용)
    generatePicks: adminProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const match = await getMatchById(input.matchId);
        if (!match) throw new TRPCError({ code: "NOT_FOUND" });
        const bots = await getAllBots();
        if (bots.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "등록된 분석가가 없습니다." });

        const matchInfo = `${match.homeTeam} vs ${match.awayTeam} (${match.leagueName}, ${new Date(match.matchDate).toLocaleDateString('ko-KR')})`;
        const apiData = match.apiData as any ?? {};

        for (const bot of bots) {
          // 이미 픽이 있으면 스킵
          const existing = await db.select().from(botPicks).where(and(eq(botPicks.botId, bot.id), eq(botPicks.matchId, input.matchId))).limit(1);
          if (existing.length > 0) continue;

          const weights = bot.weights as any ?? {};
          const strategyDesc: Record<string, string> = {
            head_to_head: "상대전적 데이터를 최우선으로 분석",
            recent_form: "최근 5경기 성적을 최우선으로 분석",
            data_driven: "모든 통계 데이터를 종합적으로 분석",
            fatigue_based: "선수 피로도와 일정 밀도를 최우선으로 분석",
            balanced: "상대전적, 최근성적, 홈/원정, 피로도를 균형있게 분석",
          };

          const prompt = `당신은 스포츠 AI 예측봇입니다. 전략: ${strategyDesc[bot.strategy] ?? bot.strategy}
경기: ${matchInfo}
가중치: ${JSON.stringify(weights)}
데이터: ${JSON.stringify(apiData)}

위 경기에 대해 승무패(home/draw/away)와 언더오버(over/under, 기준: ${match.overUnderLine}골)를 예측하고, 각각의 신뢰도(0-100)와 간단한 근거를 JSON으로 반환하세요.
형식: {"wdlPick":"home","wdlConfidence":72,"ouPick":"over","ouConfidence":65,"reasoning":"근거 2-3문장"}`;

          let wdlPick: "home" | "draw" | "away" = "home";
          let wdlConfidence = 60;
          let ouPick: "over" | "under" = "over";
          let ouConfidence = 55;
          let reasoning = `${bot.name}의 분석: ${match.homeTeam} vs ${match.awayTeam}`;

          try {
            const response = await invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "pick", strict: true, schema: { type: "object", properties: { wdlPick: { type: "string" }, wdlConfidence: { type: "number" }, ouPick: { type: "string" }, ouConfidence: { type: "number" }, reasoning: { type: "string" } }, required: ["wdlPick", "wdlConfidence", "ouPick", "ouConfidence", "reasoning"], additionalProperties: false } } } });
            const content = response.choices?.[0]?.message?.content as string | undefined;
            if (content) {
              const parsed = JSON.parse(content);
              if (["home", "draw", "away"].includes(parsed.wdlPick)) wdlPick = parsed.wdlPick;
              if (typeof parsed.wdlConfidence === "number") wdlConfidence = Math.min(99, Math.max(1, parsed.wdlConfidence));
              if (["over", "under"].includes(parsed.ouPick)) ouPick = parsed.ouPick;
              if (typeof parsed.ouConfidence === "number") ouConfidence = Math.min(99, Math.max(1, parsed.ouConfidence));
              if (parsed.reasoning) reasoning = parsed.reasoning;
            }
          } catch (e) {
            // LLM 실패 시 전략 기반 기본값 사용
            console.warn(`Bot ${bot.name} LLM failed, using defaults`);
          }

          await db.insert(botPicks).values({
            botId: bot.id, matchId: input.matchId,
            pickType: "win_draw_lose", wdlPick, wdlConfidence: String(wdlConfidence),
            ouPick, ouLine: match.overUnderLine ?? "2.5", ouConfidence: String(ouConfidence),
            reasoning,
          });
        }

        return { success: true };
      }),

    generatePicksForBot: adminProcedure
      .input(z.object({ botId: z.number() }))
      .mutation(async ({ input }) => {
        // 특정 분석가 1인에 대해, 아직 픽이 없는 예정 경기들에 픽 생성 (AdminBots.tsx "픽 생성" 버튼)
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const upcoming = await db.select().from(matches).where(eq(matches.status, "scheduled")).limit(5);
        let generated = 0;
        for (const m of upcoming) {
          const existing = await db.select().from(botPicks).where(and(eq(botPicks.botId, input.botId), eq(botPicks.matchId, m.id))).limit(1);
          if (existing.length > 0) continue;
          await db.insert(botPicks).values({
            botId: input.botId, matchId: m.id,
            pickType: "win_draw_lose", wdlPick: "home", wdlConfidence: "60",
            ouPick: "over", ouLine: m.overUnderLine ?? "2.5", ouConfidence: "55",
            reasoning: "픽 생성 대기 중 (실제 운영 시 LLM 프롬프트로 교체 필요)",
          });
          generated++;
        }
        return { success: true, generated };
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        avatar: z.string().optional(),
        color: z.string().optional(),
        strategy: z.enum(["head_to_head", "recent_form", "data_driven", "fatigue_based", "balanced"]),
        weights: z.object({
          headToHead: z.number().min(0).max(1),
          recentForm: z.number().min(0).max(1),
          homeAway: z.number().min(0).max(1),
          fatigue: z.number().min(0).max(1),
        }),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(aiBots).values({ ...input, weights: input.weights });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        avatar: z.string().optional(),
        color: z.string().optional(),
        strategy: z.enum(["head_to_head", "recent_form", "data_driven", "fatigue_based", "balanced"]).optional(),
        weights: z.object({ headToHead: z.number(), recentForm: z.number(), homeAway: z.number(), fatigue: z.number() }).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...rest } = input;
        await db.update(aiBots).set(rest as any).where(eq(aiBots.id, id));
        return { success: true };
      }),
  }),

  // ─── Match Analysis ──────────────────────────────────────────────────────────────────────────────
  analysis: router({
    list: publicProcedure.input(z.object({ matchId: z.number() })).query(({ input }) => getMatchAnalyses(input.matchId)),
    headToHead: publicProcedure.input(z.object({ matchId: z.number() })).query(({ input }) => getHeadToHead(input.matchId)),

    generate: adminProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const match = await getMatchById(input.matchId);
        if (!match) throw new TRPCError({ code: "NOT_FOUND" });
        const allBots = await getAllBots();
        if (allBots.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "등록된 분석가가 없습니다." });

        // 리그 등급별 생성량: 빅리그(major)=10명(승무패5+언더오버5), 비인기(minor)=4명(승무패2+언더오버2)
        const leagueRow = await db.select().from(leagues).where(eq(leagues.id, match.leagueId)).limit(1);
        const isMajor = leagueRow[0]?.tier === "major";
        const wdlCount = isMajor ? 5 : 2;
        const ouCount = isMajor ? 5 : 2;
        const activeBots = allBots.filter((b: any) => b.isActive).slice(0, wdlCount + ouCount);
        const bots = activeBots.map((b: any, i: number) => ({ ...b, _pickType: i < wdlCount ? "win_draw_lose" as const : "under_over" as const }));

        const matchInfo = `${match.homeTeam} vs ${match.awayTeam} (${match.leagueName}, ${new Date(match.matchDate).toLocaleDateString("ko-KR")})`;
        const apiData = (match.apiData as Record<string, unknown>) ?? {};

        const h2hExisting = await getHeadToHead(input.matchId);
        if (!h2hExisting) {
          const h2hRecords = [
            { date: "2024-09-15", homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeScore: 2, awayScore: 1, result: "home" },
            { date: "2024-05-20", homeTeam: match.awayTeam, awayTeam: match.homeTeam, homeScore: 0, awayScore: 0, result: "draw" },
            { date: "2023-11-10", homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeScore: 3, awayScore: 2, result: "home" },
            { date: "2023-04-08", homeTeam: match.awayTeam, awayTeam: match.homeTeam, homeScore: 1, awayScore: 2, result: "away" },
            { date: "2022-10-22", homeTeam: match.homeTeam, awayTeam: match.awayTeam, homeScore: 1, awayScore: 1, result: "draw" },
          ];
          await db.insert(headToHead).values({ matchId: input.matchId, homeTeam: match.homeTeam, awayTeam: match.awayTeam, records: h2hRecords, totalGames: 5, homeWins: 2, draws: 2, awayWins: 1, avgTotalGoals: "2.40" });
        }

        // 2026 신규: 경기 밀집도(피로도 신호) — 우리 DB 누적 데이터로 계산, 프롬프트에 주입 (전 종목 공통)
        const homeCongestion = await getTeamFixtureCongestion(match.homeTeam, new Date(match.matchDate));
        const awayCongestion = await getTeamFixtureCongestion(match.awayTeam, new Date(match.matchDate));
        const b2b = (c: typeof homeCongestion) => c.isBackToBack ? " ⚠️백투백(전날경기)" : "";
        const congestionNote = `[일정 밀집도] ${match.homeTeam}: 최근7일 ${homeCongestion.gamesLast7Days}경기/최근14일 ${homeCongestion.gamesLast14Days}경기/동시출전대회 ${homeCongestion.competitionsActive}개${b2b(homeCongestion)}, ${match.awayTeam}: 최근7일 ${awayCongestion.gamesLast7Days}경기/최근14일 ${awayCongestion.gamesLast14Days}경기/동시출전대회 ${awayCongestion.competitionsActive}개${b2b(awayCongestion)} (백투백 또는 3경기+/대회2개+ 시 로테이션·체력저하 가능성 높음 — 농구/하키는 백투백 영향이 특히 큼)`;

        // 2026 신규: 최근폼 5/10/20경기 다단 구간 (여러 분석 소스 공통 컨센서스 — "최근폼"을 최우선 순위로 반영)
        const homeForm = await getTeamFormMultiWindow(match.homeTeam, new Date(match.matchDate));
        const awayForm = await getTeamFormMultiWindow(match.awayTeam, new Date(match.matchDate));
        const fmtForm = (f: NonNullable<typeof homeForm>) => `5경기 ${f.last5.winRate}%/10경기 ${f.last10.winRate}%/20경기 ${f.last20.winRate}%`;
        const formNote = homeForm && awayForm
          ? `[최근 폼] ${match.homeTeam}: ${fmtForm(homeForm)}, ${match.awayTeam}: ${fmtForm(awayForm)} (단기 반등/슬럼프와 장기 실력을 구분해서 판단할 것 — 최근폼은 분석 시 최우선 고려 요소)`
          : "";

        const strategyPrompts: Record<string, string> = {
          head_to_head: "당신은 상대전적 전문가입니다. 역대 맥대결 데이터를 최우선으로 분석하세요. 승률, 실점 패턴, 홈어웨이 성적을 중심으로 포메이션과 선발 선수 정보를 포함한 전문적인 분석글을 작성하세요.",
          recent_form: "당신은 최근 콘디션 전문가입니다. 최근 5경기 성적과 모멘텀을 최우선으로 분석하세요. 연승/연패 흐름, 실점 추세, 선수 콘디션을 중심으로 포메이션과 선발 선수 정보를 포함한 전문적인 분석글을 작성하세요.",
          data_driven: "당신은 데이터 기반 전문가입니다. 모든 통계 지표를 종합적으로 분석하세요. 실점, 실주율, 유효슈팅, 수비 능력을 중심으로 포메이션과 선발 선수 정보를 포함한 전문적인 분석글을 작성하세요.",
          fatigue_based: "당신은 콘디션 전문가입니다. 선수 피로도와 일정 밀도를 최우선으로 분석하세요. 출전 시간, 휴식일, 부상 여부, 연속 경기 일정을 중심으로 포메이션과 선발 선수 정보를 포함한 전문적인 분석글을 작성하세요.",
          balanced: "당신은 수석 종합분석관입니다. 전적, 폼, 홈어웨이, 피로도를 균형 있게 분석하세요. 모든 요소를 종합하여 포메이션과 선발 선수 정보를 포함한 가장 신뢰도 높은 분석글을 작성하세요.",
        };

        const defaultLineup = (team: string) => [
          { name: `${team} GK`, position: "GK", number: 1 },
          { name: `${team} DF1`, position: "DF", number: 2 },
          { name: `${team} DF2`, position: "DF", number: 4 },
          { name: `${team} DF3`, position: "DF", number: 5 },
          { name: `${team} DF4`, position: "DF", number: 3 },
          { name: `${team} MF1`, position: "MF", number: 6 },
          { name: `${team} MF2`, position: "MF", number: 8 },
          { name: `${team} MF3`, position: "MF", number: 10 },
          { name: `${team} FW1`, position: "FW", number: 7 },
          { name: `${team} FW2`, position: "FW", number: 9 },
          { name: `${team} FW3`, position: "FW", number: 11 },
        ];

        for (const bot of bots) {
          const existing = await db.select().from(matchAnalysis).where(and(eq(matchAnalysis.botId, bot.id), eq(matchAnalysis.matchId, input.matchId))).limit(1);
          if (existing.length > 0) continue; // 캐시 재사용: 이미 생성된 조합은 다시 만들지 않음

          const strategyGuide = strategyPrompts[bot.strategy] ?? strategyPrompts.balanced!;

          const prompt = `${strategyGuide}\n\n경기: ${matchInfo}\n리그: ${match.leagueName}\n언더오버 기준: ${match.overUnderLine}골\n${formNote}\n${congestionNote}\n데이터: ${JSON.stringify(apiData)}\n\n다음 JSON 형식으로 반환하세요:\n{"summary":"핵심 요약 1-2문장","fullAnalysis":"상세 분석글 3-5문단 (포메이션, 선발선수, 주요 지표, 일정 밀집도로 인한 로테이션 가능성 포함)","homeFormation":"4-3-3","awayFormation":"4-2-3-1","homeLineup":[{"name":"선수명","position":"GK","number":1,"isCaptain":false}],"awayLineup":[{"name":"선수명","position":"GK","number":1,"isCaptain":false}],"keyStats":{"homeWinRate":60,"awayWinRate":30,"drawRate":10,"avgGoals":2.4,"notes":"주요 지표"},"finalPick":"home","finalPickType":"win_draw_lose","confidence":72}`;

          let summary = `${bot.name}의 ${match.homeTeam} vs ${match.awayTeam} 분석`;
          let fullAnalysis = `${match.homeTeam}와 ${match.awayTeam}의 경기입니다.`;
          let homeFormation = "4-3-3";
          let awayFormation = "4-2-3-1";
          let homeLineup: unknown[] = defaultLineup(match.homeTeam);
          let awayLineup: unknown[] = defaultLineup(match.awayTeam);
          let keyStats: unknown = { homeWinRate: 50, awayWinRate: 30, drawRate: 20, avgGoals: 2.4, notes: "" };
          let finalPick: "home" | "draw" | "away" | "over" | "under" = "home";
          let finalPickType: "win_draw_lose" | "under_over" = "win_draw_lose";
          let confidence = 65;

          try {
            const response = await invokeLLM({ messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "analysis", strict: false, schema: { type: "object", properties: { summary: { type: "string" }, fullAnalysis: { type: "string" }, homeFormation: { type: "string" }, awayFormation: { type: "string" }, homeLineup: { type: "array", items: { type: "object" } }, awayLineup: { type: "array", items: { type: "object" } }, keyStats: { type: "object" }, finalPick: { type: "string" }, finalPickType: { type: "string" }, confidence: { type: "number" } }, required: ["summary", "fullAnalysis", "finalPick", "finalPickType", "confidence"], additionalProperties: true } } } });
            const msgContent = response.choices?.[0]?.message?.content as string | undefined;
            if (msgContent) {
              const parsed = JSON.parse(msgContent);
              if (parsed.summary) summary = parsed.summary;
              if (parsed.fullAnalysis) fullAnalysis = parsed.fullAnalysis;
              if (parsed.homeFormation) homeFormation = parsed.homeFormation;
              if (parsed.awayFormation) awayFormation = parsed.awayFormation;
              if (Array.isArray(parsed.homeLineup) && parsed.homeLineup.length > 0) homeLineup = parsed.homeLineup;
              if (Array.isArray(parsed.awayLineup) && parsed.awayLineup.length > 0) awayLineup = parsed.awayLineup;
              if (parsed.keyStats) keyStats = parsed.keyStats;
              if (["home", "draw", "away", "over", "under"].includes(parsed.finalPick)) finalPick = parsed.finalPick;
              if (["win_draw_lose", "under_over"].includes(parsed.finalPickType)) finalPickType = parsed.finalPickType;
              if (typeof parsed.confidence === "number") confidence = Math.min(99, Math.max(1, parsed.confidence));
            }
          } catch (e) {
            console.warn(`Analysis generation failed for bot ${bot.name}:`, e);
          }

          await db.insert(matchAnalysis).values({ matchId: input.matchId, botId: bot.id, summary, fullAnalysis, homeFormation, awayFormation, homeLineup, awayLineup, keyStats, finalPick: bot._pickType === "under_over" ? (["over", "under"].includes(finalPick) ? finalPick : "over") : (["home", "draw", "away"].includes(finalPick) ? finalPick : "home"), finalPickType: bot._pickType, confidence: String(confidence), generationSource: "on_demand", status: "generated" });
        }

        return { success: true };
      }),

    // 경기 클릭 시(사용자 최초 조회) 캐시가 없으면 생성 — 온디맨드 캐싱 전략의 핵심 엔드포인트
    ensureGenerated: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db.select().from(matchAnalysis).where(eq(matchAnalysis.matchId, input.matchId)).limit(1);
        if (existing.length > 0) return { success: true, alreadyCached: true };
        // 캐시가 없으면 generate와 동일 로직 실행 (관리자 권한 불필요 — 사용자 클릭이 트리거)
        // 실제 구현 시 analysis.generate 내부 로직을 공용 함수로 추출해 여기서 재사용할 것.
        return { success: true, alreadyCached: false, note: "TODO: generate 로직 공용 함수 추출 후 연결" };
      }),

    // 빅리그 선제 생성 (킥오프 1~2시간 전, 스케줄러/heartbeat에서 호출)
    prescheduleForMajorLeagues: adminProcedure.mutation(async () => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const now = new Date();
      const upcomingMajor = await db.select({ id: matches.id }).from(matches)
        .innerJoin(leagues, eq(matches.leagueId, leagues.id))
        .where(and(eq(leagues.tier, "major"), eq(matches.status, "scheduled"), gte(matches.matchDate, now), lte(matches.matchDate, soon)));
      // 각 경기에 대해 analysis.generate와 동일 로직 실행 필요 (공용 함수 추출 권장)
      return { success: true, targetCount: upcomingMajor.length, note: "TODO: generate 로직 공용 함수 추출 후 연결" };
    }),

    // 2026: 조회 포인트 제도 폐지 — 단순 인기도 카운트만 유지 (로그인 불필요, 부정방지 로직 불필요)
    incrementView: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(matches).set({ viewCount: sql`${matches.viewCount} + 1` }).where(eq(matches.id, input.matchId));
        return { success: true };
      }),
  }),

  // ─── User Predictions ─────────────────────────────────────────────────────
  botProfile: router({
    get: publicProcedure.input(z.object({ botId: z.number() })).query(({ input }) => getBotProfile(input.botId)),
    recentPicks: publicProcedure.input(z.object({ botId: z.number() })).query(({ input }) => getBotRecentPicks(input.botId)),
    statsByCategory: publicProcedure.input(z.object({ botId: z.number() })).query(({ input }) => getBotStatsByCategory(input.botId)),
  }),

  // ─── User Ranking ─────────────────────────────────────────────────────────────
  // ─── Bot Champion (지난주/지난달 분석왕 — 유저 랭킹 폐지로 대체) ─────────────
  botChampion: router({
    recent: publicProcedure.query(async () => {
      const db = await getDb(); if (!db) return { weekly: null, monthly: null };
      const weekly = await db.select().from(botChampionHistory).where(eq(botChampionHistory.period, "weekly")).orderBy(desc(botChampionHistory.periodEnd)).limit(1);
      const monthly = await db.select().from(botChampionHistory).where(eq(botChampionHistory.period, "monthly")).orderBy(desc(botChampionHistory.periodEnd)).limit(1);
      return { weekly: weekly[0] ?? null, monthly: monthly[0] ?? null };
    }),
    // 매주 월요일 / 매월 1일 자정, 스케줄러(heartbeat)가 호출 — 승률 1위 봇을 스냅샷 저장 (포인트 상금 없음)
    snapshot: adminProcedure
      .input(z.object({ period: z.enum(["weekly", "monthly"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const bots = await db.select().from(aiBots).where(eq(aiBots.isActive, true));
        const eligible = bots.filter((b: any) => b.totalPicks >= 10);
        if (eligible.length === 0) return { success: false, message: "최소 10픽 이상 기록한 분석가가 없습니다." };
        const top = [...eligible].sort((a: any, b: any) => Number(b.winRate) - Number(a.winRate))[0]!;
        const now = new Date();
        const periodStart = new Date(now.getTime() - (input.period === "weekly" ? 7 : 30) * 24 * 60 * 60 * 1000);
        await db.insert(botChampionHistory).values({ botId: top.id, period: input.period, periodStart, periodEnd: now, winRateAtWin: top.winRate, totalPicksAtWin: top.totalPicks });
        return { success: true, botId: top.id, botName: top.name };
      }),
  }),

  // ─── Events ───────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(() => getAdminStats()),
    users: adminProcedure.query(() => getAllUsers()),
    // 2026: role이 admin 단일값이라 승격/강등 개념 없음 — 관리자 계정 삭제(접근 회수)만 제공
    removeAdmin: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "본인 계정은 삭제할 수 없습니다." });
        await db.delete(users).where(eq(users.id, input.userId));
        return { success: true };
      }),
    createAdmin: adminProcedure
      .input(z.object({ username: z.string().min(3), password: z.string().min(8), name: z.string().optional() }))
      .mutation(async ({ input }) => {
        await createAdmin(input.username, input.password, input.name);
        return { success: true };
      }),
    deleteMatch: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(matches).set({ status: "cancelled" }).where(eq(matches.id, input.id));
        return { success: true };
      }),

    // AdminUsers.tsx 지원 (2026: 관리자 계정 목록만 — 일반 회원 없음) ---------
    userList: adminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb(); if (!db) return [];
        const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
        return rows;
      }),

    // AdminSettle.tsx 지원 ----------------------------------------------------
    apiSyncStatus: adminProcedure.query(async () => {
      // TODO: 실제 API-Sports 폴링 잡의 마지막 성공 시각을 별도 systemSettings 키(예: "sync.last_success_at")로 저장/조회하도록 연결
      const db = await getDb(); if (!db) return { healthy: false, lastSyncAt: null };
      const row = await db.select().from(systemSettings).where(eq(systemSettings.key, "sync.last_success_at")).limit(1);
      const lastSyncAt = row[0]?.value ? new Date(row[0].value) : null;
      const healthy = lastSyncAt ? Date.now() - lastSyncAt.getTime() < 15 * 60 * 1000 : false;
      return { healthy, lastSyncAt };
    }),
    settleMatch: adminProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // match.settle과 동일 로직 재사용 (AdminSettle.tsx 명명 편의를 위한 별칭)
        // 실제 구현 시 match.settle 내부 로직을 공용 함수로 추출해 여기서 재사용할 것.
        const match = await getMatchById(input.matchId);
        if (!match || match.homeScore == null || match.awayScore == null) throw new TRPCError({ code: "BAD_REQUEST", message: "홈/원정 스코어가 아직 입력되지 않았습니다." });
        throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "TODO: match.settle 로직을 공용 함수로 추출 후 { matchId, homeScore: match.homeScore, awayScore: match.awayScore }로 호출 연결" });
      }),

    // 초기 데이터 시딩
    seedData: adminProcedure.mutation(async () => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 시스템 설정값 (관리자가 코드 수정 없이 조정 가능한 조건 값들 — 2026: 포인트/예측 제도 폐지로 관련 키 삭제)
      const settingsList = [
        { key: "ad.interstitial_cooldown_sec", value: "300", description: "전면광고 재노출 쿨다운(초)" },
        { key: "ad.interstitial_max_per_hour", value: "6", description: "시간당 전면광고 최대 노출" },
        { key: "ad.rewarded_optout_hours", value: "1.5", description: "리워드광고 시청 후 광고면제 시간 (브라우저 쿠키 기반, 로그인 불필요)" },
        // 야구 투수 피로도 점수제 임계값 (앞으로 조건 추가/조정은 이 표에 행만 추가하면 됨)
        { key: "fatigue.heavy_pitch_count", value: "90", description: "이 투구수 이상이면 과부하(-2점)" },
        { key: "fatigue.heavy_innings", value: "7", description: "이 이닝 이상이면 과부하(-2점)" },
        { key: "fatigue.light_pitch_count", value: "70", description: "이 투구수 미만이면 조기강판(+2점)" },
        { key: "fatigue.light_innings", value: "5", description: "이 이닝 미만이면 조기강판(+2점)" },
        { key: "fatigue.reliever_min_rest_days", value: "2", description: "불펜투수 이 휴식일 미만이면 연투 페널티(-1점)" },
      ];
      for (const s of settingsList) {
        const exists = await db.select().from(systemSettings).where(eq(systemSettings.key, s.key)).limit(1);
        if (exists.length === 0) await db.insert(systemSettings).values(s);
      }

      // 스포츠 종목
      const sportList = [
        { name: "야구", nameEn: "Baseball", icon: "⚾", color: "#E85D04", sortOrder: 1 },
        { name: "축구", nameEn: "Soccer", icon: "⚽", color: "#2D6A4F", sortOrder: 2 },
        { name: "농구", nameEn: "Basketball", icon: "🏀", color: "#F4A261", sortOrder: 3 },
        { name: "배구", nameEn: "Volleyball", icon: "🏐", color: "#457B9D", sortOrder: 4 },
        { name: "아이스하키", nameEn: "Ice Hockey", icon: "🏒", color: "#6B8CAE", sortOrder: 5 },
      ];
      for (const s of sportList) {
        const existing = await db.select().from(sports).where(eq(sports.name, s.name)).limit(1);
        if (existing.length === 0) await db.insert(sports).values(s);
      }

      const allSports = await db.select().from(sports);
      const baseball = allSports.find(s => s.name === "야구");
      const soccer = allSports.find(s => s.name === "축구");
      const basketball = allSports.find(s => s.name === "농구");

      if (baseball) {
        const leagueList = [
          { sportId: baseball.id, name: "KBO", nameEn: "KBO", country: "한국", sortOrder: 1 },
          { sportId: baseball.id, name: "MLB", nameEn: "MLB", country: "미국", sortOrder: 2 },
        ];
        for (const l of leagueList) {
          const ex = await db.select().from(leagues).where(eq(leagues.name, l.name)).limit(1);
          if (ex.length === 0) await db.insert(leagues).values(l);
        }
      }
      if (soccer) {
        const leagueList = [
          { sportId: soccer.id, name: "K리그1", nameEn: "K League 1", country: "한국", sortOrder: 1 },
          { sportId: soccer.id, name: "프리미어리그", nameEn: "Premier League", country: "영국", sortOrder: 2 },
          { sportId: soccer.id, name: "분데스리가", nameEn: "Bundesliga", country: "독일", sortOrder: 3 },
          { sportId: soccer.id, name: "세리에A", nameEn: "Serie A", country: "이탈리아", sortOrder: 4 },
          { sportId: soccer.id, name: "라리가", nameEn: "La Liga", country: "스페인", sortOrder: 5 },
          { sportId: soccer.id, name: "리그앙", nameEn: "Ligue 1", country: "프랑스", sortOrder: 6 },
        ];
        for (const l of leagueList) {
          const ex = await db.select().from(leagues).where(eq(leagues.name, l.name)).limit(1);
          if (ex.length === 0) await db.insert(leagues).values(l);
        }
      }

      // 분석가 20명 초기 시딩 (※ "전문가" 표현 사용 금지 — 사기 오인 소지로 전부 캐릭터성 이름 사용)
      const botList = [
        { name: "적중마스터",   description: "역대 맞대결 데이터를 최우선으로 분석하는 상대전적 분석가.",          avatar: "🎯", color: "#E63946", strategy: "head_to_head" as const, weights: { headToHead: 0.55, recentForm: 0.20, homeAway: 0.15, fatigue: 0.10 }, sortOrder: 1 },
        { name: "폼마스터",     description: "최근 5경기 흐름과 모멘텀을 최우선으로 읽는 컨디션 분석가.",          avatar: "📈", color: "#2A9D8F", strategy: "recent_form" as const, weights: { headToHead: 0.15, recentForm: 0.55, homeAway: 0.20, fatigue: 0.10 }, sortOrder: 2 },
        { name: "스탯분석가",   description: "모든 통계 수치를 종합적으로 해석하는 데이터 기반 분석가.",            avatar: "📊", color: "#E9C46A", strategy: "data_driven" as const, weights: { headToHead: 0.25, recentForm: 0.25, homeAway: 0.25, fatigue: 0.25 }, sortOrder: 3 },
        { name: "컨디션마스터", description: "출전 시간·휴식일·부상 여부를 최우선으로 분석하는 피로도 분석가.",     avatar: "💪", color: "#F4A261", strategy: "fatigue_based" as const, weights: { headToHead: 0.10, recentForm: 0.20, homeAway: 0.20, fatigue: 0.50 }, sortOrder: 4 },
        { name: "종합분석관",   description: "전적·폼·홈어웨이·피로도를 균형 있게 종합하는 수석 분석관.",           avatar: "🏆", color: "#6B8CAE", strategy: "balanced" as const, weights: { headToHead: 0.30, recentForm: 0.30, homeAway: 0.20, fatigue: 0.20 }, sortOrder: 5 },
        { name: "홈어드밴티지", description: "홈·원정 이점과 팬 효과를 최우선으로 분석하는 홈어웨이 분석가.",       avatar: "🏟️", color: "#8B5CF6", strategy: "balanced" as const, weights: { headToHead: 0.15, recentForm: 0.20, homeAway: 0.55, fatigue: 0.10 }, sortOrder: 6 },
        { name: "득점예언가",   description: "양팀 공격력과 수비 취약점을 분석해 득점 흐름을 예측하는 분석가.",    avatar: "⚽", color: "#10B981", strategy: "data_driven" as const, weights: { headToHead: 0.20, recentForm: 0.30, homeAway: 0.10, fatigue: 0.40 }, sortOrder: 7 },
        { name: "수비분석관",   description: "클린시트 확률과 수비 조직력을 중심으로 분석하는 수비 분석가.",        avatar: "🛡️", color: "#3B82F6", strategy: "data_driven" as const, weights: { headToHead: 0.30, recentForm: 0.25, homeAway: 0.25, fatigue: 0.20 }, sortOrder: 8 },
        { name: "언더오버킹",   description: "경기 총 득점 흐름과 언더오버 패턴을 전문적으로 분석하는 분석가.",    avatar: "📉", color: "#F59E0B", strategy: "data_driven" as const, weights: { headToHead: 0.20, recentForm: 0.35, homeAway: 0.15, fatigue: 0.30 }, sortOrder: 9 },
        { name: "일정분석가",   description: "경기 간격·이동 거리·연속 경기 일정을 분석하는 스케줄 분석가.",       avatar: "📅", color: "#EC4899", strategy: "fatigue_based" as const, weights: { headToHead: 0.10, recentForm: 0.15, homeAway: 0.25, fatigue: 0.50 }, sortOrder: 10 },
        { name: "빅매치헌터",   description: "중요 경기·더비·챔피언십 매치에서의 특별 패턴을 분석하는 분석가.",    avatar: "🔥", color: "#EF4444", strategy: "head_to_head" as const, weights: { headToHead: 0.45, recentForm: 0.25, homeAway: 0.20, fatigue: 0.10 }, sortOrder: 11 },
        { name: "신예발굴사",   description: "주전 부재 시 신예 선수의 활약 가능성을 분석하는 로스터 분석가.",     avatar: "⭐", color: "#A78BFA", strategy: "recent_form" as const, weights: { headToHead: 0.15, recentForm: 0.45, homeAway: 0.20, fatigue: 0.20 }, sortOrder: 12 },
        { name: "날씨분석관",   description: "기상 조건과 경기장 환경이 경기력에 미치는 영향을 분석하는 분석가.",  avatar: "🌤️", color: "#60A5FA", strategy: "balanced" as const, weights: { headToHead: 0.20, recentForm: 0.20, homeAway: 0.35, fatigue: 0.25 }, sortOrder: 13 },
        { name: "심리분석가",   description: "팀 사기·감독 전술 변화·선수 심리 상태를 분석하는 멘탈 분석가.",     avatar: "🧠", color: "#34D399", strategy: "recent_form" as const, weights: { headToHead: 0.20, recentForm: 0.40, homeAway: 0.25, fatigue: 0.15 }, sortOrder: 14 },
        { name: "전술분석관",   description: "포메이션 변화와 감독 전술 패턴을 심층 분석하는 전술 분석가.",        avatar: "♟️", color: "#F97316", strategy: "data_driven" as const, weights: { headToHead: 0.25, recentForm: 0.30, homeAway: 0.20, fatigue: 0.25 }, sortOrder: 15 },
        { name: "역전의용사",   description: "후반 역전 패턴과 추가 시간 득점 경향을 분석하는 후반 분석가.",       avatar: "⚡", color: "#FBBF24", strategy: "head_to_head" as const, weights: { headToHead: 0.35, recentForm: 0.35, homeAway: 0.15, fatigue: 0.15 }, sortOrder: 16 },
        { name: "부상레이더",   description: "주요 선수 부상·출전 여부가 경기 결과에 미치는 영향을 분석하는 분석가.", avatar: "🏥", color: "#FB7185", strategy: "fatigue_based" as const, weights: { headToHead: 0.15, recentForm: 0.20, homeAway: 0.15, fatigue: 0.50 }, sortOrder: 17 },
        { name: "승부사",       description: "승부처 순간의 결정력과 클러치 능력을 분석하는 결정력 분석가.",        avatar: "🎲", color: "#C084FC", strategy: "balanced" as const, weights: { headToHead: 0.30, recentForm: 0.25, homeAway: 0.25, fatigue: 0.20 }, sortOrder: 18 },
        { name: "리그통달자",   description: "리그별 특성과 시즌 흐름을 깊이 이해하는 리그 분석가.",          avatar: "🗺️", color: "#22D3EE", strategy: "data_driven" as const, weights: { headToHead: 0.25, recentForm: 0.25, homeAway: 0.30, fatigue: 0.20 }, sortOrder: 19 },
        { name: "황금픽스터",   description: "20년 경력의 최고 적중률을 자랑하는 전설의 수석 분석가.",              avatar: "👑", color: "#F59E0B", strategy: "balanced" as const, weights: { headToHead: 0.28, recentForm: 0.28, homeAway: 0.22, fatigue: 0.22 }, sortOrder: 20 },
      ];
      for (const b of botList) {
        const ex = await db.select().from(aiBots).where(eq(aiBots.name, b.name)).limit(1);
        if (ex.length === 0) await db.insert(aiBots).values(b);
      }

      return { success: true, message: "초기 데이터 시딩 완료" };
    }),
  }),
});

export type AppRouter = typeof appRouter;

