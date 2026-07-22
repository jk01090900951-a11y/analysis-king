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
  bigint,
  primaryKey,
} from "drizzle-orm/mysql-core";

// ══════════════════════════════════════════════════════════════════════════
// 분석왕 DB 스키마 — 2026 전면 재설계
// 반영된 최종 정책: 회원가입/추천인 포인트 폐지, 유저 분석글 작성 폐지(AI 20인 전용),
// 조회 기반 포인트만 지급, 분석왕 랭킹은 비금전(배지) 보상, 예측 정답 보너스는
// 오답률 연동(배팅 아님), 출금은 10,000P 이상 & 1,000P 단위, 광고는 이탈시 전면광고
// (5분 쿨다운) + 리워드광고 옵트아웃, 유료 구독 없음, 관리자 다중 계정 지원.
// 상세 근거: 분석왕 V3.0 - 포인트 정책 최종 확정.md
// ══════════════════════════════════════════════════════════════════════════

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(), // 관리자 다중 계정 지원 (role="admin"이면 누구나 관리자)
  points: int("points").default(0).notNull(), // 2026 개정: 가입 축하금 폐지, 기본값 0
  totalEarned: int("totalEarned").default(0).notNull(),
  totalSpent: int("totalSpent").default(0).notNull(),
  predictionCount: int("predictionCount").default(0).notNull(),
  correctCount: int("correctCount").default(0).notNull(),
  accountStatus: mysqlEnum("accountStatus", ["active", "warned", "restricted", "suspended", "banned"]).default("active").notNull(), // 부정사용 방지 정책 4단계
  statusExpiresAt: timestamp("statusExpiresAt"), // warned(7일)/restricted(30일)/suspended(90일) 자동 해제 시점
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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
  // 2026 신규: 빅리그 여부 — 콘텐츠 생성량/시점 결정에 사용 (analyses 테이블 참고)
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
  // 2026 신규: 정산 상태 — AdminSettle.tsx 모니터링용 (결과는 API 자동수신, 정산은 자동/수동 트리거)
  settleStatus: mysqlEnum("settleStatus", ["pending", "settled", "error"]).default("pending").notNull(),
  settledAt: timestamp("settledAt"),
  // 예측 참여 집계 캐시 (정산 시 갱신, 오답률 연동 보너스 계산·AdminSettle 표시용)
  predictionCount: int("predictionCount").default(0).notNull(),
  wrongCount: int("wrongCount").default(0).notNull(),
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
  weights: json("weights").notNull(), // { headToHead, currentWinRate, recentForm, homeAway, streak, scoringRate, awayFatigue, restInterval } 합계 1.0
  totalPicks: int("totalPicks").default(0).notNull(),
  correctPicks: int("correctPicks").default(0).notNull(),
  winRate: decimal("winRate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  currentRank: int("currentRank").default(0).notNull(), // 전체(최대 20인) 중 실시간 순위
  currentStreak: int("currentStreak").default(0).notNull(),
  maxStreak: int("maxStreak").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiBot = typeof aiBots.$inferSelect;
export type InsertAiBot = typeof aiBots.$inferInsert;

// ─── Bot Weekly/Monthly Champion (지난주/지난달 분석왕 기록) ──────────────────
// 2026 신규: 랭킹 포인트 상금 폐지 → 대신 기간별 우승 이력을 스냅샷으로 저장해 노출
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
  // 2026: isLocked 필드 삭제 (광고 게이팅 전면 폐지 — 모든 픽 자유 열람)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Match Analysis (AI 분석글 — 온디맨드 생성 + 캐시) ────────────────────────
// 캐싱 전략: matchId+botId 조합이 이미 있으면 재사용, 없으면 그 때 1회 생성.
// 빅리그(leagues.tier=major)는 킥오프 1~2시간 전 스케줄러가 선제 생성(10개: 승무패5+언더오버5),
// 비인기(minor)는 최초 클릭 시점에만 생성(4개: 승무패2+언더오버2).
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
  // 2026: isLocked 필드 삭제 (게이팅 폐지)
  generationSource: mysqlEnum("generationSource", ["on_demand", "prescheduled"]).default("on_demand").notNull(), // 캐싱 전략 추적용
  status: mysqlEnum("status", ["pending", "generated", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MatchAnalysis = typeof matchAnalysis.$inferSelect;
export type InsertMatchAnalysis = typeof matchAnalysis.$inferInsert;

// ─── Analysis Views (분석글 조회 — 포인트 지급의 유일한 트리거) ───────────────
// 2026: 유저 작성 분석글 폐지로 "작성자 몫" 개념 삭제. 조회자 포인트만 지급.
// TOP10/추천수 게이팅도 폐지 (유저 스팸 우려 자체가 사라짐 — AI만 작성하므로).
export const analysisViews = mysqlTable("analysis_views", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  analysisId: int("analysisId").notNull(), // matchAnalysis.id
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
  dwellSeconds: int("dwellSeconds").default(0).notNull(), // 30초 이상이어야 유효 조회
  isValid: boolean("isValid").default(false).notNull(), // 유효조회 확정 여부 (로그인+30초+비정상아님)
  pointsAwarded: int("pointsAwarded").default(0).notNull(),
});

// ─── User Predictions (사용자 예측 참여 — 무료, 배팅 아님) ────────────────────
export const userPredictions = mysqlTable("user_predictions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchId: int("matchId").notNull(),
  pickType: mysqlEnum("pickType", ["win_draw_lose", "under_over"]).notNull(),
  wdlChoice: mysqlEnum("wdlChoice", ["home", "draw", "away"]),
  ouChoice: mysqlEnum("ouChoice", ["over", "under"]),
  basePointsEarned: int("basePointsEarned").default(0).notNull(), // 참여 즉시 지급 (기본 10P, 정답/오답 무관)
  bonusPointsEarned: int("bonusPointsEarned").default(0).notNull(), // 정답 시 오답률 연동 보너스 (0~30P, 정산 후 확정)
  isCorrect: boolean("isCorrect"),
  isSettled: boolean("isSettled").default(false).notNull(),
  resultRevealedAt: timestamp("resultRevealedAt"), // 2026: 광고 시청 조건 삭제, 정산 즉시 자동 반영
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Point History (포인트 내역) ──────────────────────────────────────────────
export const pointHistory = mysqlTable("point_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "earn_view",         // 분석글 조회 (2026 기준 사실상 유일한 상시 적립 경로)
    "earn_base",         // 예측 참여 기본 적립 (10P)
    "earn_correct",      // 예측 정답 보너스 (오답률 연동)
    "earn_event",        // 이벤트
    "admin_grant",       // 관리자 수동 지급
    "admin_revoke",      // 관리자 수동 회수
    "spend_exchange",    // 포인트 교환 사용
  ]).notNull(),
  amount: int("amount").notNull(),
  balance: int("balance").notNull(),
  description: varchar("description", { length: 300 }),
  refId: int("refId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── System Settings (관리자 설정 가능 포인트 값 — 하드코딩 대신 DB 값 사용) ──
export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(), // 예: "point.view_amount", "predict.base_amount"
  value: varchar("value", { length: 500 }).notNull(),
  description: varchar("description", { length: 300 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
// 초기 시딩 예시:
// { key: "point.view_amount", value: "1", description: "분석글 조회 시 지급 포인트" }
// { key: "predict.base_amount", value: "10", description: "예측 참여 기본 포인트" }
// { key: "predict.bonus_tier1", value: "10", description: "오답률 50~70% 구간 보너스" }
// { key: "predict.bonus_tier2", value: "20", description: "오답률 70~90% 구간 보너스" }
// { key: "predict.bonus_tier3", value: "30", description: "오답률 90%+ 구간 보너스" }
// { key: "ad.interstitial_cooldown_sec", value: "300", description: "전면광고 재노출 쿨다운(초)" }
// { key: "ad.interstitial_max_per_hour", value: "6", description: "시간당 전면광고 최대 노출" }
// { key: "ad.rewarded_optout_hours", value: "1.5", description: "리워드광고 시청 후 광고면제 시간" }

// ─── Exchange Methods (교환 수단) ─────────────────────────────────────────────
export const exchangeMethods = mysqlTable("exchange_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["naverpay", "kakaopay", "gift_card", "custom"]).notNull(),
  description: text("description"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  minPoints: int("minPoints").default(10000).notNull(), // 2026: 최소 10,000P
  maxPoints: int("maxPoints").default(1000000).notNull(),
  unitPoints: int("unitPoints").default(1000).notNull(), // 2026 신규: 신청 단위 (1,000P 단위로만 신청, 잔여 락업)
  conversionRate: decimal("conversionRate", { precision: 10, scale: 4 }).default("1.0000").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Exchange Requests (교환 신청) ────────────────────────────────────────────
export const exchangeRequests = mysqlTable("exchange_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  methodId: int("methodId").notNull(),
  points: int("points").notNull(), // 반드시 unitPoints(1,000)의 배수 — 앱 레벨에서 검증
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  accountInfo: varchar("accountInfo", { length: 300 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Ad Log (광고 노출 기록 — 빈도제한 + 리워드 옵트아웃 추적) ────────────────
// 2026 전면 재설계: 기존 3종(bot_pick_unlock/result_reveal/analysis_unlock)은
// 전부 게이팅용이라 폐지. 이제는 "빈도 제한"과 "옵트아웃 만료 시각" 추적이 핵심.
export const adLog = mysqlTable("ad_log", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adType: mysqlEnum("adType", ["banner", "interstitial_exit", "rewarded_optout"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 리워드 광고 시청으로 획득한 "광고 없이 이용" 상태 (사용자당 최대 1개 활성)
export const adFreeSession = mysqlTable("ad_free_session", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(), // 시청 시점 + ad.rewarded_optout_hours
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Comments (커뮤니티 댓글 — 경량, 신고 대상) ───────────────────────────────
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchId: int("matchId").notNull(),
  content: varchar("content", { length: 500 }).notNull(),
  isHidden: boolean("isHidden").default(false).notNull(), // 신고 누적 시 자동 비공개
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Reports (신고) ───────────────────────────────────────────────────────────
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporterId").notNull(),
  targetType: mysqlEnum("targetType", ["comment"]).notNull(), // 유저 분석글 폐지로 comment만 대상
  targetId: int("targetId").notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "actioned"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Events (특별 이벤트) ──────────────────────────────────────────────────────
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["special", "seasonal"]).default("special").notNull(), // 2026: monthly_ranking 삭제(랭킹 상금 폐지)
  prizes: json("prizes"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["upcoming", "active", "ended"]).default("upcoming").notNull(),
  bannerImageUrl: varchar("bannerImageUrl", { length: 500 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Head To Head (상대전적 캐시) ──────────────────────────────────────────────
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

// ─── Pitcher Start History (야구 투수 등판 이력 — 자체 누적, 외부 API 미의존) ─
// 2026 신규: KBO는 공식 API가 없고, API-Sports도 투구수를 확실히 제공하는지 미확인.
// 그래서 "경기 종료 시점마다 우리 DB에 직접 쌓는" 방식으로 설계.
// 매치 정산(match.settle) 시점에 이 테이블에 1행씩 자동 적재하고,
// 다음 등판 분석 시엔 외부 API를 다시 호출하지 않고 이 테이블만 조회하면 됨.
export const pitcherStartHistory = mysqlTable("pitcher_start_history", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(), // 선수 고유ID가 API에 없을 경우 이름+팀으로 식별
  teamName: varchar("teamName", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["starter", "reliever"]).default("starter").notNull(),
  startDate: timestamp("startDate").notNull(),
  inningsPitched: decimal("inningsPitched", { precision: 4, scale: 1 }), // API가 이닝만 줘도 최소 이 지표는 확보 가능
  pitchCount: int("pitchCount"), // API가 투구수를 주면 채움, 없으면 NULL(이닝으로 대체 판단)
  earnedRuns: int("earnedRuns"),
  strikeouts: int("strikeouts"),
  restDaysBeforeThis: int("restDaysBeforeThis"), // 직전 등판일로부터 이번 등판까지 며칠 쉬었는지 (자동 계산)
  thirdTimeThroughRisk: boolean("thirdTimeThroughRisk").default(false).notNull(), // 2026 신규: 세이버메트릭스 "타순 3회전 페널티" — 6이닝 이상 시 타순을 3번째 상대했을 가능성 높음(피안타율 급증 구간으로 알려짐)
  // 아래 두 필드가 "점수제"의 핵심 산출값 — 정산 시 자동 계산되어 저장됨
  fatigueScore: int("fatigueScore").default(0).notNull(), // -2~+2 (7이닝+90구 이상 -2, 5이닝미만+70구미만 +2, 그 외 0)
  restPenalty: int("restPenalty").default(0).notNull(), // 5일 미만 연투 시 -1
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// 조회 예시: 다음 등판 예정 투수의 "직전 등판" 1건을 playerName 기준으로 최신순 조회
// → fatigueScore + restPenalty 합산값을 봇 프롬프트에 "컨디션 점수: -3" 식으로 주입

// ─── Player Appearance Log (축구 선수 출전이력 — 로테이션 신호 감지용) ────────
// 2026 신규: "경기 밀집도"(최근 N일 경기수)와 "동시 출전 대회 수"는 이미 matches
// 테이블에서 바로 계산 가능(새 테이블 불필요). 다만 "오늘 라인업이 평소 주전과
// 얼마나 다른가"(로테이션 신호)는 선수별 출전 이력을 따로 쌓아야 계산 가능해서 신설.
export const playerAppearanceLog = mysqlTable("player_appearance_log", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  teamName: varchar("teamName", { length: 100 }).notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(),
  isStarter: boolean("isStarter").default(true).notNull(),
  minutesPlayed: int("minutesPlayed"), // API가 제공하면 채움 (fixtures/players 통계)
  matchDate: timestamp("matchDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
// 조회 예시: 특정 팀의 최근 10경기 중 이 선수가 몇 번 선발 출전했는지 비율을 계산 →
// "평소 8/10 선발인데 오늘 라인업에 없음" = 로테이션/부상/전술 변화 신호로 활용

// ══════════════════════════════════════════════════════════════════════════
// 2026 전면 삭제된 테이블 (참고용 — 실제 마이그레이션 시 DROP)
// - user_analysis: 유저 분석글 작성 폐지로 완전 삭제
// - ad_watch_log: 광고 게이팅 폐지로 ad_log/ad_free_session으로 대체
// ══════════════════════════════════════════════════════════════════════════
