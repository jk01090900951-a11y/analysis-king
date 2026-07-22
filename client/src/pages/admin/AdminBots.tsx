import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Edit, Zap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

// 초기 시딩용 20명 분석가 (관리자가 이후 자유롭게 수정 가능 — 아래 값은 초기 제안값)
// 전략(strategy) 5종을 고르게 분배: head_to_head, recent_form, data_driven, fatigue_based, balanced
export const SEED_BOTS = [
  { name: "승률왕", avatar: "🎯", color: "#F59E0B", strategy: "head_to_head", description: "역대 상대전적을 가장 중요하게 분석합니다." },
  { name: "데이터마스터", avatar: "🧠", color: "#3B82F6", strategy: "data_driven", description: "득점, 실점, 점유율 등 모든 통계를 종합 분석합니다." },
  { name: "트렌드분석가", avatar: "📈", color: "#10B981", strategy: "recent_form", description: "최근 5경기 흐름을 최우선으로 반영합니다." },
  { name: "통계브레인", avatar: "📊", color: "#6366F1", strategy: "data_driven", description: "누적 통계 기반으로 확률을 계산합니다." },
  { name: "라이브분석가", avatar: "🔴", color: "#EF4444", strategy: "fatigue_based", description: "출전 시간과 경기 간격, 피로도를 중점 분석합니다." },
  { name: "홈그라운드박사", avatar: "🏠", color: "#8B5CF6", strategy: "head_to_head", description: "홈/원정 상대전적 패턴을 집중 분석합니다." },
  { name: "폼체크러", avatar: "🔥", color: "#F97316", strategy: "recent_form", description: "현재 팀 컨디션과 연승/연패 흐름을 봅니다." },
  { name: "밸런스마스터", avatar: "⚖️", color: "#14B8A6", strategy: "balanced", description: "모든 요소를 균형 있게 종합 반영합니다." },
  { name: "피지컬분석가", avatar: "💪", color: "#DC2626", strategy: "fatigue_based", description: "선수 부상·체력 데이터를 중점적으로 봅니다." },
  { name: "넘버크런처", avatar: "🔢", color: "#2563EB", strategy: "data_driven", description: "고급 통계 지표(xG 등)를 활용합니다." },
  { name: "다크호스헌터", avatar: "🐴", color: "#7C3AED", strategy: "recent_form", description: "최근 상승세인 언더독을 즐겨 찾습니다." },
  { name: "전적분석왕", avatar: "📜", color: "#B45309", strategy: "head_to_head", description: "장기 상대전적 데이터베이스를 활용합니다." },
  { name: "스탯가디언", avatar: "🛡️", color: "#0EA5E9", strategy: "data_driven", description: "실점 관련 방어 지표를 중시합니다." },
  { name: "컨디션체커", avatar: "❄️", color: "#06B6D4", strategy: "fatigue_based", description: "연전 일정과 이동 거리를 분석합니다." },
  { name: "올라운드분석가", avatar: "🌐", color: "#65A30D", strategy: "balanced", description: "다각도 데이터를 고르게 조합합니다." },
  { name: "매치업스페셜리스트", avatar: "🤝", color: "#DB2777", strategy: "head_to_head", description: "전술적 상성과 맞대결 기록을 분석합니다." },
  { name: "모멘텀트래커", avatar: "📉", color: "#EA580C", strategy: "recent_form", description: "경기 흐름의 모멘텀 변화를 추적합니다." },
  { name: "딥데이터랩", avatar: "🔬", color: "#4F46E5", strategy: "data_driven", description: "대규모 데이터 기반 예측 모델을 씁니다." },
  { name: "로테이션워처", avatar: "🔄", color: "#0D9488", strategy: "fatigue_based", description: "선수단 로테이션과 주전 여부를 확인합니다." },
  { name: "종합진단가", avatar: "🩺", color: "#9333EA", strategy: "balanced", description: "경기 전 모든 변수를 종합 진단합니다." },
];

const STRATEGY_LABEL: Record<string, string> = {
  head_to_head: "상대전적 위주",
  recent_form: "최근폼 위주",
  data_driven: "데이터 종합",
  fatigue_based: "컨디션/피로도",
  balanced: "균형 분석",
};

const CRITERIA = [
  { key: "recentForm", label: "최근 폼 (5·10·20경기 구간 종합)" },
  { key: "homeAway", label: "팀 전력 (홈/원정 승률·공수밸런스)" },
  { key: "fatigue", label: "피로도/일정 (부상·로테이션·연속경기)" },
  { key: "headToHead", label: "상대전적" },
];
// 2026 개정: 기존 8개 항목을 백엔드(bot.create/update, 시드데이터)가 실제로 쓰는
// 4개 키(headToHead/recentForm/homeAway/fatigue)로 통일. 그동안 화면(8개)과
// 저장 구조(4개)가 불일치했던 부분을 이번에 맞췄습니다.

export default function AdminBots() {
  const utils = trpc.useUtils();
  const { data: bots, isLoading } = trpc.bot.list.useQuery();
  const [dialog, setDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [form, setForm] = useState<any>({});
  const [weights, setWeights] = useState<Record<string, number>>({});

  const createBot = trpc.bot.create.useMutation({
    onSuccess: () => { toast.success("분석가 추가 완료"); utils.bot.list.invalidate(); setDialog({ open: false }); },
    onError: (e) => toast.error(e.message),
  });
  const updateBot = trpc.bot.update.useMutation({
    onSuccess: () => { toast.success("분석가 수정 완료"); utils.bot.list.invalidate(); setDialog({ open: false }); },
    onError: (e) => toast.error(e.message),
  });
  const toggleActive = trpc.bot.update.useMutation({
    onSuccess: () => { utils.bot.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const genPicksForBot = trpc.bot.generatePicksForBot.useMutation({
    onSuccess: () => toast.success("픽 생성 요청 완료 (다음 경기 대상)"),
    onError: (e) => toast.error(e.message),
  });

  // 2026 개정: 여러 스포츠분석 소스 공통 우선순위(최근폼 > 팀전력 > 피로도/부상 > 상대전적) 반영
  const defaultWeights = { recentForm: 0.35, homeAway: 0.25, fatigue: 0.25, headToHead: 0.15 };

  const open = (data?: any) => {
    if (data) {
      setForm(data);
      setWeights(data.weights ?? defaultWeights);
    } else {
      setForm({ name: "", avatar: "🤖", color: "#6366F1", strategy: "balanced", description: "" });
      setWeights(defaultWeights);
    }
    setDialog({ open: true, data });
  };

  const weightSum = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);

  const save = () => {
    if (Math.abs(weightSum - 1) > 0.01) {
      toast.error(`가중치 합이 100%가 되어야 합니다 (현재 ${(weightSum * 100).toFixed(0)}%)`);
      return;
    }
    const payload = { ...form, weights };
    if (dialog.data) updateBot.mutate({ id: dialog.data.id, ...payload });
    else createBot.mutate(payload);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">전문 분석가(AI 봇) 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">현재 {bots?.length ?? 0}명 운영 중 (초기 시딩 기준 20명)</p>
        </div>
        <Button size="sm" onClick={() => open()}><Plus className="w-4 h-4 mr-1" />분석가 추가</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(bots ?? []).map((bot: any) => (
            <div key={bot.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: `${bot.color}22`, border: `2px solid ${bot.color}66` }}>
                {bot.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{bot.name}</span>
                  {bot.currentRank && bot.currentRank <= 3 && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Trophy className="w-2.5 h-2.5 mr-0.5" />{bot.currentRank}위</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{STRATEGY_LABEL[bot.strategy] ?? bot.strategy} · 승률 {Number(bot.winRate ?? 0).toFixed(1)}% · 총 {bot.totalPicks ?? 0}픽</p>
              </div>
              <Switch checked={bot.isActive} onCheckedChange={(v) => toggleActive.mutate({ id: bot.id, isActive: v })} />
              <Button size="sm" variant="ghost" onClick={() => open(bot)}><Edit className="w-3 h-3" /></Button>
              <Button size="sm" variant="outline" onClick={() => genPicksForBot.mutate({ botId: bot.id })} disabled={genPicksForBot.isPending}>
                <Zap className="w-3 h-3 mr-1" />픽 생성
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.data ? "분석가 수정" : "분석가 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">이름</label>
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">아바타(이모지)</label>
                <Input value={form.avatar ?? ""} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">색상(hex)</label>
                <Input value={form.color ?? ""} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">전략</label>
                <Select value={form.strategy ?? "balanced"} onValueChange={(v) => setForm({ ...form, strategy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STRATEGY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">소개(설명)</label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[60px]" />
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground">판단 기준 가중치</label>
                <span className={`text-xs font-bold ${Math.abs(weightSum - 1) > 0.01 ? "text-destructive" : "text-green-500"}`}>
                  합계 {(weightSum * 100).toFixed(0)}% {Math.abs(weightSum - 1) > 0.01 ? "(100%로 맞춰주세요)" : "✓"}
                </span>
              </div>
              <div className="space-y-3">
                {CRITERIA.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0">{c.label}</span>
                    <Slider
                      value={[Math.round((weights[c.key] ?? 0) * 100)]}
                      max={100}
                      step={5}
                      onValueChange={([v]) => setWeights({ ...weights, [c.key]: v / 100 })}
                      className="flex-1"
                    />
                    <span className="text-xs w-10 text-right">{Math.round((weights[c.key] ?? 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDialog({ open: false })}>취소</Button>
            <Button className="flex-1" onClick={save}>저장</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
