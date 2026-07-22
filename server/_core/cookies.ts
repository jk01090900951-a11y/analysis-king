import { ENV } from "./env";

export function getSessionCookieOptions(_req?: unknown) {
  return {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30일
    path: "/",
  };
}
