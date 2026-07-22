import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ══════════════════════════════════════════════════════════════════════════
// 분석왕 DB 스키마 — 2026 최종 개정 (순수 콘텐츠+광고 모델)
// 반영된 정책: 회원가입/로그인 전면 폐지(관리자만 예외), 포인트 제도 전면 폐지,
// 유료결제 없음, 예측 참여·교환소 기능 폐지(계정이 없으므로 개인별 추적 불가능해짐).
// 사이트는 이제 "AI 분석가 20인이 쓰는 분석글을 누구나 무료로 열람 + 광고로만 운영"
// 하는 순수 콘텐츠 사이트입니다. 상세 근거: 대화 내역 참고.
// ══════════════════════════════════════════════════════════════════════════

// ─── Admin Users (관리자 전용 — 일반 회원가입 없음) ────────────────────────
// 2026: 카카오 로그인 폐지 — 아이디/비밀번호 기반 관리자 전용 계정
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 200 }).notNull(),
  name: text("name"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Sports (스포츠 종목) ─────────────────────────────────────────────────────
export const sports = mysqlTable("sports", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  icon: varchar("icon", { length: 100 }),
  color: varchar("color", { length: 20 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Leagues (리그) ───────────────────────────────────────────────────────────
export const leagues = mysqlTable("leagues", {
  id: int("id").autoincrement().primaryKey(),
  sportId: int("sportId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  country: varchar("country", { length: 50 }),
  logoUrl: varchar("logoUrl", { length: 500 }),
  externalLeagueId: varchar("externalLeagueId", { length: 50 }), // API-Sports.io의 리그 ID (예: EPL=39). 이게 있어야 자동 동기화 가능
  tier: mysqlEnum("tier", ["major", "minor"]).default("minor").notNull(), // major=빅리그(픽10개, 킥오프전 선제생성) / minor=비인기(픽4개, 클릭시 생성)
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Matches (경기) ───────────────────────────────────────────────────────────
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  leagueId: int("leagueId").notNull(),
  homeTeam: varchar("homeTeam", { length: 100 }).notNull(),
  awayTeam: varchar("awayTeam", { length: 100 }).notNull(),
  homeTeamLogo: varchar("homeTeamLogo", { length: 500 }),
  awayTeamLogo: varchar("awayTeamLogo", { length: 500 }),
  matchDate: timestamp("matchDate").notNull(),
  venue: varchar("venue", { length: 200 }),
  homeScore: int("homeScore"),
  awayScore: int("awayScore"),
  result: mysqlEnum("result", ["home", "draw", "away"]),
  totalGoals: int("totalGoals"),
  overUnderLine: decimal("overUnderLine", { precision: 4, scale: 1 }).default("2.5"),
  apiData: json("apiData"),
  externalId: varchar("externalId", { length: 100 }), // API-Sports 경기 ID (자동 동기화 매칭 키)
  status: mysqlEnum("status", ["scheduled", "live", "finished", "cancelled"]).default("scheduled").notNull(),
  settleStatus: mysqlEnum("settleStatus", ["pending", "settled", "error"]).default("pending").notNull(),
  settledAt: timestamp("settledAt"),
  viewCount: int("viewCount").default(0).notNull(), // 2026: 포인트와 무관한 단순 인기도 지표(조회수)만 유지
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;

// ─── AI Bots (AI 분석가 — 20인 고정, 관리자가 추가/수정 가능) ─────────────────
export const aiBots = mysqlTable("ai_bots", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 예: 승률왕, 데이터마스터 (※ "전문가" 표현 금지 — 사기 오인 소지)
  description: text("description"),
  avatar: varchar("avatar", { length: 100 }),
  color: varchar("color", { length: 20 }),
  strategy: mysqlEnum("strategy", [
    "head_to_head",
    "recent_form",
    "data_driven",
    "fatigue_based",
    "balanced",
  ]).notNull(),
  weights: json("weights").notNull(), // { headToHead, recentForm, homeAway, fatigue } 합계 1.0
  totalPicks: int("totalPicks").default(0).notNull(),
  correctPicks: int("correctPicks").default(0).notNull(),
  winRate: decimal("winRate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  currentRank: int("currentRank").default(0).notNull(),
  currentStreak: int("currentStreak").default(0).notNull(),
  maxStreak: int("maxStreak").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiBot = typeof aiBots.$inferSelect;
export type InsertAiBot = typeof aiBots.$inferInsert;

// ─── Bot Weekly/Monthly Champion (지난주/지난달 분석왕 기록, 비금전) ──────────
export const botChampionHistory = mysqlTable("bot_champion_history", {
  id: int("id").autoincrement().primaryKey(),
  botId: int("botId").notNull(),
  period: mysqlEnum("period", ["weekly", "monthly"]).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  winRateAtWin: decimal("winRateAtWin", { precision: 5, scale: 2 }).notNull(),
  totalPicksAtWin: int("totalPicksAtWin").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Bot Picks (봇 예측 픽) ───────────────────────────────────────────────────
export const botPicks = mysqlTable("bot_picks", {
  id: int("id").autoincrement().primaryKey(),
  botId: int("botId").notNull(),
  matchId: int("matchId").notNull(),
  pickType: mysqlEnum("pickType", ["win_draw_lose", "under_over"]).notNull(),
  wdlPick: mysqlEnum("wdlPick", ["home", "draw", "away"]),
  wdlConfidence: decimal("wdlConfidence", { precision: 5, scale: 2 }),
  ouPick: mysqlEnum("ouPick", ["over", "under"]),
  ouLine: decimal("ouLine", { precision: 4, scale: 1 }),
  ouConfidence: decimal("ouConfidence", { precision: 5, scale: 2 }),
  reasoning: text("reasoning"),
  isCorrect: boolean("isCorrect"),
  isSettled: boolean("isSettled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Match Analysis (AI 분석글 — 온디맨드 생성 + 캐시) ────────────────────────
export const matchAnalysis = mysqlTable("match_analysis", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  botId: int("botId").notNull(),
  summary: text("summary").notNull(),
  fullAnalysis: text("fullAnalysis").notNull(),
  homeFormation: varchar("homeFormation", { length: 20 }),
  awayFormation: varchar("awayFormation", { length: 20 }),
  homeLineup: json("homeLineup"),
  awayLineup: json("awayLineup"),
  keyStats: json("keyStats"),
  finalPick: mysqlEnum("finalPick", ["home", "draw", "away", "over", "under"]).notNull(),
  finalPickType: mysqlEnum("finalPickType", ["win_draw_lose", "under_over"]).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  generationSource: mysqlEnum("generationSource", ["on_demand", "prescheduled"]).default("on_demand").notNull(),
  status: mysqlEnum("status", ["pending", "generated", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type InsertMatchAnalysis = typeof matchAnalysis.$inferInsert;

// ─── System Settings (관리자 설정 가능 값 — 하드코딩 대신 DB 값 사용) ─────────
export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  description: varchar("description", { length: 300 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// 초기 시딩 예시:
// { key: "ad.interstitial_cooldown_sec", value: "300", description: "전면광고 재노출 쿨다운(초)" }
// { key: "ad.interstitial_max_per_hour", value: "6", description: "시간당 전면광고 최대 노출" }
// { key: "fatigue.heavy_pitch_count", value: "90", description: "..." } 등 (기존 피로도 임계값)

// ─── Pitcher Start History (야구 투수 등판 이력 — 자체 누적, 외부 사이트 스크래핑 금지) ─
export const pitcherStartHistory = mysqlTable("pitcher_start_history", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(),
  teamName: varchar("teamName", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["starter", "reliever"]).default("starter").notNull(),
  startDate: timestamp("startDate").notNull(),
  inningsPitched: decimal("inningsPitched", { precision: 4, scale: 1 }),
  pitchCount: int("pitchCount"),
  earnedRuns: int("earnedRuns"),
  strikeouts: int("strikeouts"),
  restDaysBeforeThis: int("restDaysBeforeThis"),
  thirdTimeThroughRisk: boolean("thirdTimeThroughRisk").default(false).notNull(),
  fatigueScore: int("fatigueScore").default(0).notNull(),
  restPenalty: int("restPenalty").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Player Appearance Log (축구 등 선수 출전이력 — 로테이션 신호 감지용) ─────
export const playerAppearanceLog = mysqlTable("player_appearance_log", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  teamName: varchar("teamName", { length: 100 }).notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(),
  isStarter: boolean("isStarter").default(true).notNull(),
  minutesPlayed: int("minutesPlayed"),
  matchDate: timestamp("matchDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Head To Head (상대전적 캐시 — API-Sports 라이선스 데이터 기반) ───────────
export const headToHead = mysqlTable("head_to_head", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  homeTeam: varchar("homeTeam", { length: 100 }).notNull(),
  awayTeam: varchar("awayTeam", { length: 100 }).notNull(),
  records: json("records").notNull(),
  totalGames: int("totalGames").default(0).notNull(),
  homeWins: int("homeWins").default(0).notNull(),
  draws: int("draws").default(0).notNull(),
  awayWins: int("awayWins").default(0).notNull(),
  avgTotalGoals: decimal("avgTotalGoals", { precision: 4, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ══════════════════════════════════════════════════════════════════════════
// 2026 전면 삭제된 테이블 (참고용 — 실제 마이그레이션 시 DROP)
// - point_history, exchange_methods, exchange_requests: 포인트 제도 폐지로 삭제
// - analysis_views: 조회 포인트 지급 폐지로 삭제 (viewCount는 matches에 단순 카운트로 대체)
// - user_predictions: 회원가입 폐지로 개인별 예측 추적 불가능해져 삭제
// - ad_log, ad_free_session, comments, reports: 회원가입 폐지로 계정 기반 기능 전부 삭제
// - user_analysis: 이미 이전 개정에서 삭제됨 (유저 작성 콘텐츠 자체가 없음)
// ══════════════════════════════════════════════════════════════════════════
