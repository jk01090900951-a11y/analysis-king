import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// 실제 서비스 연동 시 Google AdSense 스크립트로 교체 (아래는 자리 표시 + 빈도 로직 뼈대)
export default function AdBanner({ slot = "default", format, className = "" }: { slot?: string; format?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: adConfig } = trpc.settings.adConfig.useQuery();

  useEffect(() => {
    // TODO: 실제 AdSense <ins class="adsbygoogle"> 태그 삽입 + (window.adsbygoogle = window.adsbygoogle || []).push({})
  }, []);

  // 관리자가 "배너 광고 OFF"로 설정하면 아예 렌더링하지 않음
  if (adConfig && !adConfig.bannerEnabled) return null;

  return (
    <div ref={ref} className={`w-full rounded-lg border border-dashed border-border/50 bg-accent/10 flex items-center justify-center text-xs text-muted-foreground py-6 ${className}`} data-ad-slot={slot}>
      광고 영역 (AdSense 연동 예정)
    </div>
  );
}
