import { Link } from "wouter";

interface LiveMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  status: string;
  leagueName: string | null;
  sportIcon: string | null;
}

export default function LiveScoreCarousel({ matches, isLoading }: { matches: LiveMatch[]; isLoading?: boolean }) {
  if (isLoading) {
    return <div className="flex gap-3 overflow-x-auto py-2">{[1, 2, 3].map((i) => <div key={i} className="w-64 h-24 rounded-xl bg-accent/30 animate-pulse shrink-0" />)}</div>;
  }
  if (!matches?.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">현재 진행 중인 경기가 없습니다.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide">
      {matches.map((m) => (
        <Link key={m.id} href={`/matches/${m.id}`}>
          <a className="w-64 shrink-0 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{m.sportIcon} {m.leagueName}</span>
              {m.status === "live" && <span className="text-xs font-bold text-red-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>}
            </div>
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="truncate flex-1">{m.homeTeam}</span>
              <span className="mx-2 font-bold text-primary">{m.homeScore ?? "-"} : {m.awayScore ?? "-"}</span>
              <span className="truncate flex-1 text-right">{m.awayTeam}</span>
            </div>
          </a>
        </Link>
      ))}
    </div>
  );
}
