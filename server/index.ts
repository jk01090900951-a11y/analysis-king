import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import { ensureBootstrapAdmin, refreshLiveMatchStatuses, autoSyncAllLeagues, getSyncScheduleSettings } from "./db";
import { ENV } from "./_core/env";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));
// 로그인/로그아웃은 트림 trpc.auth.login / trpc.auth.logout 로 처리됩니다 (별도 REST 라우트 없음)

// ─── 프로덕션: 빌드된 클라이언트 정적 파일 서빙 ────────────────────────────
if (ENV.NODE_ENV === "production") {
  const clientDist = path.join(process.cwd(), "dist/client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

ensureBootstrapAdmin().finally(() => {
  app.listen(ENV.PORT, () => {
    console.log(`[분석왕] 서버 실행 중 — http://localhost:${ENV.PORT}`);
  });

  // 2026 신규: 5분마다 곧 시작/진행중인 경기 상태를 API-Sports에서 다시 확인해 자동 갱신
  // (예정→진행중→종료 전환이 자동으로 반영되도록. API 사용량 절감을 위해 "최근24시간~2시간이내시작" 범위만 좁게 확인)
  setInterval(() => {
    refreshLiveMatchStatuses(false)
      .then((r) => { if (r.updated > 0) console.log(`[경기상태 자동갱신] 확인 ${r.checked}건 중 ${r.updated}건 갱신됨`); })
      .catch((e) => console.error("[경기상태 자동갱신 실패]", e));
  }, 5 * 60 * 1000);

  // 2026 신규: 3시간마다 한 번, 30일 전체 범위로 넓게 확인해서 혹시 놓친(방치된) 경기를 뒤늦게라도 잡아줌
  setInterval(() => {
    refreshLiveMatchStatuses(true)
      .then((r) => { if (r.updated > 0) console.log(`[경기상태 보완갱신(넓은범위)] 확인 ${r.checked}건 중 ${r.updated}건 갱신됨`); })
      .catch((e) => console.error("[경기상태 보완갱신 실패]", e));
  }, 3 * 60 * 60 * 1000);

  // 2026 신규: 관리자가 지정한 요일+시간에 맞춰 전체 리그 자동 동기화 (매분 확인, 같은 분에 중복 실행 방지)
  // 예) 요일=월,수,금 시간=00:00 으로 설정하면 그 요일 그 시각에만 실행됨. 수동 버튼은 이 스케줄과 별개로 항상 사용 가능.
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  let lastAutoSyncMinuteKey = "";
  setInterval(() => {
    getSyncScheduleSettings()
      .then((schedule) => {
        if (!schedule.enabled) return;
        const now = new Date();
        const todayKey = DAY_KEYS[now.getDay()];
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const nowTime = `${hh}:${mm}`;
        const minuteKey = `${now.toDateString()}_${nowTime}`;
        if (schedule.days.includes(todayKey!) && schedule.time === nowTime && lastAutoSyncMinuteKey !== minuteKey) {
          lastAutoSyncMinuteKey = minuteKey;
          console.log(`[예약 자동동기화] ${todayKey} ${nowTime} 조건 일치 — 실행 시작`);
          autoSyncAllLeagues()
            .then((r) => console.log(`[예약 자동동기화] 리그 ${r.checked}개 확인 — 성공 ${r.synced}, 실패 ${r.failed}`))
            .catch((e) => console.error("[예약 자동동기화 실패]", e));
        }
      })
      .catch((e) => console.error("[동기화 스케줄 확인 실패]", e));
  }, 60 * 1000);
});
