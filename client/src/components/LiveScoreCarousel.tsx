import { Link } from "wouter";
import { Clock } from "lucide-react";
import { formatLiveStatus } from "@/lib/matchStatus";

interface LiveMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  status: string;
  statusLong?: string | null;
  statusElapsed?: number | null;
  leagueName: string | null;
  sportIcon: string | null;
}

export default function LiveScoreCarousel({ matches, isLoading }: { matches: LiveMatch[]; isLoading?: boolean }) {
  if (isLoading) {
    return <div className="flex gap-3 overflow-x-auto py-2">{[1, 2, 3].map((i) => <div key={i} className="w-60 sm:w-64 h-28 rounded-xl bg-accent/30 animate-pulse shrink-0" />)}</div>;
  }
  if (!matches?.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">예정된 경기가 없습니다.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide snap-x snap-mandatory">
      {matches.map((m) => (
        <Link key={m.id} href={`/matches/${m.id}`}>
          <a className="w-60 sm:w-64 shrink-0 snap-start rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors block">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground truncate">{m.sportIcon} {m.leagueName}</span>
              {m.status === "live" ? (
                <span className="text-xs font-bold text-red-500 flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{formatLiveStatus(m.status, m.statusLong ?? null, m.statusElapsed ?? null) || "LIVE"}</span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(m.matchDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="truncate flex-1">{m.homeTeam}</span>
              <span className="mx-2 font-bold shrink-0 flex items-center gap-1">
                <span className={m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore ? "text-red-500" : "text-primary"}>{m.homeScore ?? "-"}</span>
                <span className="text-muted-foreground text-xs">:</span>
                <span className={m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore ? "text-red-500" : "text-primary"}>{m.awayScore ?? "-"}</span>
              </span>
              <span className="truncate flex-1 text-right">{m.awayTeam}</span>
            </div>
          </a>
        </Link>
      ))}
    </div>
  );
}
