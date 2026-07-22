import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserByOpenId } from "../db";
import { COOKIE_NAME } from "@shared/const";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const openId = req.cookies?.[COOKIE_NAME] as string | undefined;
  const user = openId ? await getUserByOpenId(openId) : null;
  return { req, res, user };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  return next({ ctx });
});
