import { useState, useEffect } from "react";
import { X, Megaphone } from "lucide-react";

const STORAGE_KEY = "analysisking_ad_notice_dismissed";

// 2026: "광고를 허용해야 이용 가능"한 강제 게이팅이 아니라, 쿠키 동의 배너처럼
// 한 번 보여주고 닫으면 다시 안 뜨는 투명성 고지입니다. 콘텐츠 접근을 막지 않습니다.
export default function AdNoticeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage 불가 시 그냥 안 띄움 (막는 게 아니므로 안전)
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  if (!visible) return null;

  return (
    <div className="bg-accent/50 border-b border-border">
      <div className="container py-2.5 px-4 flex items-center gap-3 text-xs md:text-sm text-muted-foreground">
        <Megaphone className="w-4 h-4 shrink-0 text-primary" />
        <span className="flex-1">이 사이트는 광고 수익으로 무료 운영됩니다. 모든 분석글은 회원가입 없이 자유롭게 열람 가능합니다.</span>
        <button onClick={dismiss} className="shrink-0 p-1 hover:text-foreground transition-colors" aria-label="닫기">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
