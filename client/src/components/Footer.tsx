import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/30 mt-12">
      <div className="container py-10 px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-black" />
              </div>
              <span className="font-bold gold-text">분석왕</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              20명의 분석가가 만드는 스포츠 경기 분석 콘텐츠를 회원가입 없이 무료로 제공합니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">바로가기</h3>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <Link href="/matches"><a className="hover:text-foreground transition-colors">경기 분석</a></Link>
              <Link href="/bots"><a className="hover:text-foreground transition-colors">분석가 랭킹</a></Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">안내</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              경기 일정 및 통계 데이터는 API-Sports를 통해 제공받습니다.
            </p>
          </div>
        </div>
        <div className="pt-6 border-t border-border/50 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            분석왕의 모든 분석글은 AI 분석가가 통계 데이터를 기반으로 작성한 참고 자료이며, 실제 경기 결과를 보장하지 않습니다.
            게재된 예측 승률·신뢰도 수치는 통계적 추정치로, 투자·배팅 등 금전적 판단의 근거로 사용하지 마시기 바랍니다.
          </p>
          <p className="text-[11px] text-muted-foreground">
            © {year} 분석왕. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
