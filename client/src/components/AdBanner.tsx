import { useEffect, useRef } from "react";

// 실제 서비스 연동 시 Google AdSense 스크립트로 교체 (아래는 자리 표시 + 빈도 로직 뼈대)
export default function AdBanner({ slot = "default", format, className = "" }: { slot?: string; format?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: 실제 AdSense <ins class="adsbygoogle"> 태그 삽입 + (window.adsbygoogle = window.adsbygoogle || []).push({})
    // 전면광고(이탈 시) 빈도 제한(5분 쿨다운, 시간당 6회)은 별도 훅(useInterstitialAd 등)에서 관리 예정 —
    // 분석왕 V3.0 정책 12.2/12.3 참고
  }, []);

  return (
    <div ref={ref} className={`w-full rounded-lg border border-dashed border-border/50 bg-accent/10 flex items-center justify-center text-xs text-muted-foreground py-6 ${className}`} data-ad-slot={slot}>
      광고 영역 (AdSense 연동 예정)
    </div>
  );
}
