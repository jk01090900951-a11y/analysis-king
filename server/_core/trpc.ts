import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { getUserById } from "../db";
import { ENV } from "./env";
import { COOKIE_NAME } from "@shared/const";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  let user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, ENV.JWT_SECRET) as { userId: number };
      user = (await getUserById(payload.userId)) ?? null;
    } catch {
      user = null; // 토큰 만료/위조 — 로그아웃 상태로 처리
    }
  }
  return { req, res, user };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 2026: 로그인 자체가 관리자 전용이라 protectedProcedure === adminProcedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure;
