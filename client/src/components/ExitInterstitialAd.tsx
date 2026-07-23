import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";

const LAST_SHOWN_KEY = "analysisking_interstitial_last_shown";
const COUNT_KEY = "analysisking_interstitial_hour_count";
const COUNT_HOUR_KEY = "analysisking_interstitial_hour_bucket";

// 이탈(페이지 나가기) 시 전면광고 — 관리자가 끄면 전혀 안 뜨고, 켜져 있어도
// 쿨다운(기본 5분)과 시간당 최대횟수(기본 6회)를 넘으면 자동으로 스킵됩니다.
export function useExitInterstitial() {
  const { data: adConfig } = trpc.settings.adConfig.useQuery();
  const [showing, setShowing] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);

  const isEligible = useCallback(() => {
    if (!adConfig || !adConfig.interstitialEnabled) return false;
    try {
      const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY) ?? "0");
      const cooldownMs = adConfig.cooldownSec * 1000;
      if (Date.now() - lastShown < cooldownMs) return false;

      const currentHourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
      const savedBucket = Number(localStorage.getItem(COUNT_HOUR_KEY) ?? "0");
      const count = savedBucket === currentHourBucket ? Number(localStorage.getItem(COUNT_KEY) ?? "0") : 0;
      if (count >= adConfig.maxPerHour) return false;

      return true;
    } catch {
      return false; // localStorage 접근 불가 시 안전하게 광고 없이 진행
    }
  }, [adConfig]);

  const recordShown = () => {
    try {
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      const currentHourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
      const savedBucket = Number(localStorage.getItem(COUNT_HOUR_KEY) ?? "0");
      const count = savedBucket === currentHourBucket ? Number(localStorage.getItem(COUNT_KEY) ?? "0") : 0;
      localStorage.setItem(COUNT_HOUR_KEY, String(currentHourBucket));
      localStorage.setItem(COUNT_KEY, String(count + 1));
    } catch {}
  };

  // 페이지를 나가려는 시점에 이 함수를 호출 — 조건 충족 시 광고 보여준 뒤 navigateFn 실행, 아니면 바로 실행
  const triggerExit = useCallback((navigateFn: () => void) => {
    if (!isEligible()) { navigateFn(); return; }
    recordShown();
    setPendingNavigate(() => navigateFn);
    setCountdown(3);
    setShowing(true);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  }, [isEligible]);

  const closeAndNavigate = () => {
    setShowing(false);
    pendingNavigate?.();
    setPendingNavigate(null);
  };

  const AdOverlay = showing ? (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 text-center relative">
        {countdown === 0 && (
          <button onClick={closeAndNavigate} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="h-40 rounded-xl bg-accent/30 flex items-center justify-center text-sm text-muted-foreground mb-4">
          광고 영역 (AdSense 연동 예정)
        </div>
        <p className="text-xs text-muted-foreground">
          {countdown > 0 ? `${countdown}초 후 닫기 버튼이 나타납니다` : "닫기를 눌러 계속하세요"}
        </p>
      </div>
    </div>
  ) : null;

  return { triggerExit, AdOverlay };
}
