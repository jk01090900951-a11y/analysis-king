import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { toast } from "sonner";

export default function AdminMatches() {
  const utils = trpc.useUtils();
  const { data: matches, isLoading } = trpc.match.list.useQuery({ status: "scheduled" });

  const genPicks = trpc.bot.generatePicks.useMutation({
    onSuccess: () => toast.success("AI 픽 생성 완료"),
    onError: (e) => toast.error(e.message),
  });
  const genAnalysis = trpc.analysis.generate.useMutation({
    onSuccess: () => { toast.success("분석글 생성 완료"); utils.match.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">경기 등록 · AI 콘텐츠 생성</h1>
      <p className="text-sm text-muted-foreground mb-4">경기 일정/결과는 API-Sports에서 자동 수신됩니다. 여기서는 분석 콘텐츠 생성을 관리합니다.</p>
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">로딩 중...</div>
        ) : (
          (matches ?? []).map((m: any) => (
            <div key={m.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4">
              <span className="text-xl">{m.sportIcon}</span>
              <div className="flex-1">
                <div className="font-bold text-sm">{m.homeTeam} vs {m.awayTeam}</div>
                <div className="text-xs text-muted-foreground">{m.leagueName} · {new Date(m.matchDate).toLocaleString("ko-KR")}</div>
              </div>
              <Badge variant="outline">{m.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => genPicks.mutate({ matchId: m.id })} disabled={genPicks.isPending}>
                <Zap className="w-3 h-3 mr-1" />픽 생성
              </Button>
              <Button size="sm" onClick={() => genAnalysis.mutate({ matchId: m.id })} disabled={genAnalysis.isPending}>
                분석글 생성
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
