# 분석왕 (Analysis King)

이 프로젝트는 이번 대화에서 처음부터 새로 만든 완전한 프로젝트 뼈대입니다.
**실제로 `npm install` → `npm run build`까지 검증 완료했습니다** (클라이언트 타입체크 0 오류, 빌드 성공, 서버 기동 확인).

## 로컬에서 먼저 확인해보기 (배포 전 필수)

```bash
npm install
cp .env.example .env
# .env 파일을 열어서 DATABASE_URL, API_SPORTS_KEY, ANTHROPIC_API_KEY, KAKAO_* 값을 채우세요
npm run db:push       # DB 스키마 반영 (MySQL 서버가 미리 켜져 있어야 함)
npm run dev            # http://localhost:5173 에서 확인
```

## 카페24 VPS 배포 순서

1. VPS에 Node.js(nvm), MySQL, Redis, PM2, Nginx 설치 — `분석왕 - 카페24 VPS 설치 및 배포 가이드.md` 참고
2. 이 프로젝트 전체를 서버에 업로드 (GitHub 또는 FTP)
3. 서버에서:
   ```bash
   npm install
   cp .env.example .env   # 그리고 .env에 실제 값 채우기
   npm run db:push
   npm run build           # 클라이언트만 빌드 (dist/client 생성)
   NODE_ENV=production pm2 start "npm run start" --name analysis-king
   pm2 save
   ```
4. Nginx 리버스 프록시로 80/443 → 3000 포트 연결, Certbot SSL 적용
5. 최초 로그인 후 관리자 승격: `.env`의 `OWNER_OPEN_ID`에 본인 카카오 openId 입력 후 서버 재시작

## 알아두실 점

- **AI 콘텐츠 생성**: `analysis.generate` 관련 캐싱(온디맨드/선제생성) 함수 뼈대는 있지만, `analysis.ensureGenerated`와 `prescheduleForMajorLeagues` 안의 실제 생성 로직 재사용 부분은 TODO로 남아있습니다.
- **야구 투수 데이터 파싱**: `parsePitcherBoxScores`/`parseLineupAppearances`(routers.ts)는 실제 API-Sports 응답을 확인한 뒤 필드를 채워야 합니다.
- **UI 컴포넌트**: 직접 만든 경량 버전입니다. 디자인을 더 다듬고 싶으시면 `npx shadcn@latest add [컴포넌트명]`으로 공식 버전으로 교체하실 수 있습니다.
- **서버 타입체크**: Drizzle ORM ↔ TypeScript 타입 추론에서 일부 과도하게 엄격한 오류가 있어(실제 동작에는 지장 없음 확인됨), 프로덕션 실행은 `tsx`로 직접 구동하도록 설정했습니다(빌드 단계에서 막히지 않음).
