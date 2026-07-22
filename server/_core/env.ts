import "dotenv/config";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  PORT: Number(process.env.PORT ?? 3000),
  API_SPORTS_KEY: process.env.API_SPORTS_KEY ?? "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // 최초 관리자 계정 부트스트랩용 (서버 최초 기동 시, admin 계정이 하나도 없으면 이 값으로 자동 생성됨)
  ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "",
};

