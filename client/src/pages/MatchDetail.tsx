import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useExitInterstitial } from "@/components/ExitInterstitialAd";
import MatchStatsTabs from "@/components/MatchStatsTabs";
import {
  Trophy, ChevronDown, ChevronUp, Star,
  Shield, Zap, BarChart2, ArrowLeft
} from "lucide-react";

type LineupPlayer = { name: string; position: string; number: number; isCaptain?: boolean };
type KeyStats = { homeWinRate?: number; awayWinRate?: number; drawRate?: number; avgGoals?: number; notes?: string };
type Analysis = {
  id: number; matchId: number; botId: number; summary: string; fullAnalysis: string;
  homeFormation: string | null; awayFormation: string | null;
  homeLineup: unknown; awayLineup: unknown; keyStats: unknown;
  finalPick: string; finalPickType: string; confidence: string;
  status: string; createdAt: string;
  botName: string | null; botAvatar: string | null; botColor: string | null;
  botStrategy: string | null; botRank: number | null; botWinRate: string | null;
  botTotalPicks: number | null; botCorrectPicks: number | null;
};

const PICK_LABEL: Record<string, string> = { home: "홈 승", draw: "무승부", away: "원정 승", over: "오버", under: "언더" };
const PICK_COLOR: Record<string, string> = { home: "text-blue-400", draw: "text-yellow-400", away: "text-red-400", over: "text-green-400", under: "text-purple-400" };
const STRATEGY_LABEL: Record<string, string> = { head_to_head: "상대전적 분석", recent_form: "최근 폼 분석", data_driven: "데이터 기반 분석", fatigue_based: "피로도·컨디션 분석", balanced: "종합 균형 분석" };
const RANK_BADGE: Record<number, { label: string; cls: string }> = {
  1:  { label: "🥇 1위",  cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  2:  { label: "🥈 2위",  cls: "bg-slate-400/20 text-slate-300 border-slate-400/40" },
  3:  { label: "🥉 3위",  cls: "bg-amber-700/20 text-amber-500 border-amber-700/40" },
  4:  { label: "4위",     cls: "bg-orange-600/20 text-orange-400 border-orange-600/30" },
  5:  { label: "5위",     cls: "bg-rose-600/20 text-rose-400 border-rose-600/30" },
  6:  { label: "6위",     cls: "bg-purple-600/20 text-purple-400 border-purple-600/30" },
  7:  { label: "7위",     cls: "bg-indigo-600/20 text-indigo-400 border-indigo-600/30" },
  8:  { label: "8위",     cls: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  9:  { label: "9위",     cls: "bg-cyan-600/20 text-cyan-400 border-cyan-600/30" },
  10: { label: "10위",    cls: "bg-teal-600/20 text-teal-400 border-teal-600/30" },
  11: { label: "11위",    cls: "bg-green-700/20 text-green-400 border-green-700/30" },
  12: { label: "12위",    cls: "bg-lime-700/20 text-lime-400 border-lime-700/30" },
  13: { label: "13위",    cls: "bg-yellow-700/20 text-yellow-500 border-yellow-700/30" },
  14: { label: "14위",    cls: "bg-amber-800/20 text-amber-500 border-amber-800/30" },
  15: { label: "15위",    cls: "bg-orange-800/20 text-orange-400 border-orange-800/30" },
  16: { label: "16위",    cls: "bg-red-800/20 text-red-400 border-red-800/30" },
  17: { label: "17위",    cls: "bg-pink-800/20 text-pink-400 border-pink-800/30" },
  18: { label: "18위",    cls: "bg-fuchsia-800/20 text-fuchsia-400 border-fuchsia-800/30" },
  19: { label: "19위",    cls: "bg-violet-800/20 text-violet-400 border-violet-800/30" },
  20: { label: "20위",    cls: "bg-zinc-700/20 text-zinc-400 border-zinc-700/30" },
};

function parseLineup(raw: unknown): LineupPlayer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p === "object") as LineupPlayer[];
}
function parseKeyStats(raw: unknown): KeyStats {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as KeyStats;
  return {};
}

function FormationDisplay({ formation, lineup, team }: { formation: string; lineup: LineupPlayer[]; team: string }) {
  const positions: Record<string, LineupPlayer[]> = { GK: [], DF: [], MF: [], FW: [] };
  lineup.forEach((p) => { const pos = p.position?.toUpperCase(); if (pos && positions[pos]) positions[pos].push(p); });
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <p className="text-xs font-bold text-foreground/70 mb-1">{team} <span className="text-primary">{formation}</span></p>
      <div className="w-full bg-green-900/30 border border-green-800/40 rounded-lg p-3 min-h-[180px] relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col justify-around pointer-events-none opacity-20">
          {[0,1,2].map(i => <div key={i} className="border-t border-green-400 mx-4" />)}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-green-400" />
        </div>
        {["FW","MF","DF","GK"].map((pos) => (
          positions[pos] && positions[pos].length > 0 && (
            <div key={pos} className="flex justify-around mb-2 relative z-10">
              {positions[pos].map((p, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${pos === "GK" ? "bg-yellow-600/80 border-yellow-400 text-white" : "bg-blue-600/80 border-blue-400 text-white"}`}>{p.number}</div>
                  <span className="text-[9px] text-foreground/60 max-w-[40px] truncate text-center">{p.name?.split(" ").slice(-1)[0] || p.name}</span>
                  {p.isCaptain && <span className="text-[8px] text-yellow-400">©</span>}
                </div>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function AnalystCard({ analysis, rank }: { analysis: Analysis; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const homeLineup = parseLineup(analysis.homeLineup);
  const awayLineup = parseLineup(analysis.awayLineup);
  const keyStats = parseKeyStats(analysis.keyStats);
  const rankInfo = RANK_BADGE[rank] ?? RANK_BADGE[5]!;
  const confidence = parseFloat(analysis.confidence ?? "0");
  return (
    <div className="rounded-xl border border-border/60 hover:border-primary/40 transition-all duration-200 overflow-hidden" style={{ background: "rgba(20,20,30,0.8)" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold border-2 shrink-0" style={{ background: `${analysis.botColor ?? "#6366f1"}22`, borderColor: `${analysis.botColor ?? "#6366f1"}66` }}>
              {analysis.botAvatar ?? "🔮"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-foreground">{analysis.botName ?? "분석가"}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rankInfo.cls}`}>{rankInfo.label}</Badge>
              </div>
              <p className="text-[11px] text-foreground/50 mt-0.5">{STRATEGY_LABEL[analysis.botStrategy ?? ""] ?? "종합 분석"}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-lg font-black ${PICK_COLOR[analysis.finalPick] ?? "text-primary"}`}>{PICK_LABEL[analysis.finalPick] ?? analysis.finalPick}</div>
            <div className="text-[11px] text-foreground/50">신뢰도 {confidence.toFixed(0)}%</div>
          </div>
        </div>
        <div className="mt-3"><Progress value={confidence} className="h-1.5" /></div>
        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{analysis.summary}</p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="mt-2 w-full text-xs text-foreground/60 hover:text-foreground">
          {expanded ? <><ChevronUp className="w-3 h-3 mr-1" />접기</> : <><ChevronDown className="w-3 h-3 mr-1" />전체 분석 보기</>}
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border/30 p-4 space-y-5">
          <div>
            <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2">📋 상세 분석</h4>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{analysis.fullAnalysis}</p>
          </div>
          {keyStats && (
            <div>
              <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-3">📊 핵심 지표</h4>
              <div className="grid grid-cols-3 gap-2">
                {keyStats.homeWinRate !== undefined && <div className="bg-blue-500/10 rounded-lg p-2 text-center"><div className="text-lg font-bold text-blue-400">{keyStats.homeWinRate}%</div><div className="text-[10px] text-foreground/50">홈 승률</div></div>}
                {keyStats.drawRate !== undefined && <div className="bg-yellow-500/10 rounded-lg p-2 text-center"><div className="text-lg font-bold text-yellow-400">{keyStats.drawRate}%</div><div className="text-[10px] text-foreground/50">무승부율</div></div>}
                {keyStats.awayWinRate !== undefined && <div className="bg-red-500/10 rounded-lg p-2 text-center"><div className="text-lg font-bold text-red-400">{keyStats.awayWinRate}%</div><div className="text-[10px] text-foreground/50">원정 승률</div></div>}
                {keyStats.avgGoals !== undefined && <div className="bg-green-500/10 rounded-lg p-2 text-center col-span-3"><div className="text-lg font-bold text-green-400">{keyStats.avgGoals}</div><div className="text-[10px] text-foreground/50">평균 총 득점</div></div>}
              </div>
              {keyStats.notes && <p className="text-xs text-foreground/50 mt-2 italic">{keyStats.notes}</p>}
            </div>
          )}
          {(homeLineup.length > 0 || awayLineup.length > 0) && (
            <div>
              <h4 className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-3">⚽ 예상 포메이션 & 선발</h4>
              <div className="grid grid-cols-2 gap-3">
                <FormationDisplay formation={analysis.homeFormation ?? "4-3-3"} lineup={homeLineup} team="홈" />
                <FormationDisplay formation={analysis.awayFormation ?? "4-3-3"} lineup={awayLineup} team="원정" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const matchId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { triggerExit, AdOverlay } = useExitInterstitial();

  const { data: match, isLoading: matchLoading } = trpc.match.getById.useQuery({ id: matchId }, { enabled: !!matchId });
  const { data: analyses = [], isLoading: analysesLoading, refetch: refetchAnalyses } = trpc.analysis.list.useQuery({ matchId }, { enabled: !!matchId });
  const { data: h2h } = trpc.analysis.headToHead.useQuery({ matchId }, { enabled: !!matchId });

  const ensureGenerated = trpc.analysis.ensureGenerated.useMutation({
    onSuccess: (r) => { if (!r.alreadyCached) refetchAnalyses(); },
    onError: () => {}, // 사용자 화면에는 실패를 노출하지 않음(관리자 로그에서 확인)
  });
  const incrementView = trpc.analysis.incrementView.useMutation();

  // 분석글이 없는 경기를 열람하면 자동으로 분석가의 글을 불러옵니다 (관리자 수동 생성 버튼 없음)
  useEffect(() => {
    if (matchId && !analysesLoading && analyses.length === 0 && !ensureGenerated.isPending && !ensureGenerated.isSuccess) {
      ensureGenerated.mutate({ matchId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, analysesLoading, analyses.length]);

  useEffect(() => {
    if (matchId) incrementView.mutate({ matchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (matchLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-foreground/50">경기 정보 불러오는 중...</p>
      </div>
    </div>
  );
  if (!match) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-foreground/50">경기를 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => triggerExit(() => navigate("/matches"))}>목록으로</Button>
      </div>
    </div>
  );

  const hasAnalyses = analyses.length > 0;
  const matchDate = new Date(match.matchDate);

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/30">
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => triggerExit(() => navigate("/matches"))} className="shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <p className="text-xs text-foreground/50 truncate">{match.leagueName}</p>
            <p className="text-sm font-semibold truncate">{match.homeTeam} vs {match.awayTeam}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* 경기 정보 카드 */}
        <div className="rounded-2xl border border-border/40 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,25,0.95) 100%)" }}>
          <div className="px-5 pt-4 flex items-center justify-between">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary/80">{match.leagueName}</Badge>
            <Badge variant="outline" className={`text-xs ${match.status === "live" ? "border-red-500/50 text-red-400 animate-pulse" : match.status === "finished" ? "border-green-500/30 text-green-400" : "border-border/30 text-foreground/50"}`}>
              {match.status === "live" ? "🔴 LIVE" : match.status === "finished" ? "✅ 종료" : "⏰ 예정"}
            </Badge>
          </div>
          <div className="px-5 py-5 grid grid-cols-3 items-center gap-3">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl mb-2">🏠</div>
              <p className="font-bold text-sm leading-tight">{match.homeTeam}</p>

            </div>
            <div className="text-center">
              {match.status === "finished" && match.homeScore !== null ? (
                <div className="text-3xl font-black text-foreground">{match.homeScore} : {match.awayScore}</div>
              ) : (
                <div className="text-2xl font-black text-foreground/30">VS</div>
              )}
              <p className="text-xs text-foreground/40 mt-1">{matchDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</p>
              <p className="text-xs text-foreground/40">{matchDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
              {match.overUnderLine && <p className="text-xs text-foreground/30 mt-1">O/U {match.overUnderLine}</p>}
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mb-2">✈️</div>
              <p className="font-bold text-sm leading-tight">{match.awayTeam}</p>

            </div>
          </div>
          {h2h && (
            <div className="mx-5 mb-4 p-3 rounded-xl bg-white/3 border border-border/20">
              <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-wider mb-2">최근 상대전적 ({h2h.totalGames}경기)</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400 font-bold">{match.homeTeam} {h2h.homeWins}승</span>
                <div className="flex-1 flex h-2 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-blue-500 rounded-l-full" style={{ width: `${(h2h.homeWins / h2h.totalGames) * 100}%` }} />
                  <div className="bg-yellow-500" style={{ width: `${(h2h.draws / h2h.totalGames) * 100}%` }} />
                  <div className="bg-red-500 rounded-r-full" style={{ width: `${(h2h.awayWins / h2h.totalGames) * 100}%` }} />
                </div>
                <span className="text-xs text-red-400 font-bold">{h2h.awayWins}승 {match.awayTeam}</span>
              </div>
              <div className="flex justify-center mt-1">
                <span className="text-[10px] text-foreground/30">무 {h2h.draws}회 · 평균 {h2h.avgTotalGoals}골</span>
              </div>
            </div>
          )}
        </div>

        {/* 경기 상세 정보 탭 (상대전적/팀기록/라인업/부상자/배당률) */}
        <MatchStatsTabs matchId={matchId} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />

        {/* 분석가 픽 섹션 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">스포츠전문분석 픽</h2>
          </div>
          {!hasAnalyses ? (
            <div className="rounded-xl border border-border/30 p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse"><Zap className="w-6 h-6 text-primary/50" /></div>
              <p className="text-sm text-foreground/50">분석가의 글을 불러오고 있습니다...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(analyses as Analysis[]).map((analysis, idx) => (
                <AnalystCard key={analysis.id} analysis={analysis} rank={analysis.botRank ?? (idx + 1)} />
              ))}
            </div>
          )}
        </div>

        {/* 상대전적 상세 */}
        {h2h && Array.isArray(h2h.records) && h2h.records.length > 0 && (
          <div className="rounded-2xl border border-border/40 p-5 space-y-3" style={{ background: "rgba(20,20,30,0.8)" }}>
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /><h2 className="font-bold text-sm">최근 상대전적</h2></div>
            <div className="space-y-2">
              {(h2h.records as Array<{ date: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; result: string }>).map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                  <span className="text-[11px] text-foreground/40 w-20 shrink-0">{r.date}</span>
                  <span className="text-xs text-right flex-1 truncate">{r.homeTeam}</span>
                  <span className="text-sm font-bold text-foreground shrink-0 w-12 text-center">{r.homeScore} - {r.awayScore}</span>
                  <span className="text-xs flex-1 truncate">{r.awayTeam}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${r.result === "home" ? "text-blue-400 border-blue-500/30" : r.result === "draw" ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                    {r.result === "home" ? "홈 승" : r.result === "draw" ? "무" : "원정 승"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {AdOverlay}
    </div>
  );
}
