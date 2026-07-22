import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { upsertUser, getUserByOpenId } from "./db";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// ─── 카카오 로그인 (원클릭 소셜 로그인) ────────────────────────────────────
app.get("/api/auth/kakao", (_req, res) => {
  const params = new URLSearchParams({
    client_id: ENV.KAKAO_CLIENT_ID,
    redirect_uri: ENV.KAKAO_REDIRECT_URI,
    response_type: "code",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
});

app.get("/api/auth/kakao/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) return res.redirect("/?login=failed");

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ENV.KAKAO_CLIENT_ID,
        client_secret: ENV.KAKAO_CLIENT_SECRET,
        redirect_uri: ENV.KAKAO_REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect("/?login=failed");

    const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const openId = `kakao_${profile.id}`;

    await upsertUser({
      openId,
      name: profile.properties?.nickname ?? "회원",
      email: profile.kakao_account?.email ?? undefined,
      loginMethod: "kakao",
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, openId, cookieOptions);
    res.redirect("/");
  } catch (err) {
    console.error("[Kakao Login Error]", err);
    res.redirect("/?login=failed");
  }
});

// ─── 프로덕션: 빌드된 클라이언트 정적 파일 서빙 ────────────────────────────
if (ENV.NODE_ENV === "production") {
  const clientDist = path.join(process.cwd(), "dist/client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(ENV.PORT, () => {
  console.log(`[분석왕] 서버 실행 중 — http://localhost:${ENV.PORT}`);
});
