import "dotenv/config";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  PORT: Number(process.env.PORT ?? 3000),
  API_SPORTS_KEY: process.env.API_SPORTS_KEY ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID ?? "",
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET ?? "",
  KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // 카카오 로그인 후 openId가 이 값과 일치하면 자동으로 관리자 권한 부여 (최초 관리자 부트스트랩용)
  // 카카오 로그인 콘솔 로그에서 본인의 openId(kakao_숫자) 확인 후 .env에 채워넣으세요
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};
