import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import { ensureBootstrapAdmin, refreshLiveMatchStatuses } from "./db";
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
  // (예정→진행중→종료 전환이 자동으로 반영되도록. API 요청 절약을 위해 대상 경기만 선별해서 조회함)
  setInterval(() => {
    refreshLiveMatchStatuses()
      .then((r) => { if (r.updated > 0) console.log(`[경기상태 자동갱신] 확인 ${r.checked}건 중 ${r.updated}건 갱신됨`); })
      .catch((e) => console.error("[경기상태 자동갱신 실패]", e));
  }, 5 * 60 * 1000);
});
