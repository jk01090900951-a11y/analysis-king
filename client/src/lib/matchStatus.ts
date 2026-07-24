// API-Football의 status.long 원문(영어)을 한글 표시로 매핑
const LONG_STATUS_KO: Record<string, string> = {
  "Halftime": "하프타임",
  "First Half": "전반",
  "Second Half": "후반",
  "Extra Time": "연장",
  "Penalty In Progress": "승부차기",
  "Break Time": "휴식중",
};

// 경기 목록/카드에 쓰는 짧은 라이브 표시 (예: "후반 67'")
export function formatLiveStatus(status: string, statusLong: string | null, statusElapsed: number | null): string {
  if (status !== "live") return "";
  const label = statusLong ? (LONG_STATUS_KO[statusLong] ?? statusLong) : "진행중";
  if (label === "하프타임" || label === "휴식중" || label === "승부차기") return label;
  return statusElapsed != null ? `${label} ${statusElapsed}'` : label;
}
