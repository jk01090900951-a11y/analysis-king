import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useFavoriteSports } from "@/_core/hooks/useFavoriteSports";
import { Star } from "lucide-react";

export default function CategoryMenu() {
  const { data: sports } = trpc.sport.list.useQuery();
  const [location] = useLocation();
  const { favorites, toggle, isFavorite } = useFavoriteSports();

  // 즐겨찾기한 종목을 앞쪽으로 정렬 (그 안에서는 원래 순서 유지)
  const sorted = [...(sports ?? [])].sort((a: any, b: any) => {
    const fa = isFavorite(a.id) ? 0 : 1;
    const fb = isFavorite(b.id) ? 0 : 1;
    return fa - fb;
  });

  return (
    <div className="border-b border-border bg-card/50">
      <div className="container flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
        <Link href="/matches">
          <a className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${location === "/matches" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            전체
          </a>
        </Link>
        {favorites.length > 0 && (
          <Link href="/matches?favorites=1">
            <a className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-primary" />즐겨찾기
            </a>
          </Link>
        )}
        {sorted.map((s: any) => (
          <div key={s.id} className="relative group shrink-0">
            <Link href={`/matches?sportId=${s.id}`}>
              <a className="pl-4 pr-7 py-2 rounded-lg text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </a>
            </Link>
            <button
              onClick={(e) => { e.preventDefault(); toggle(s.id); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 opacity-40 hover:opacity-100 transition-opacity"
              title={isFavorite(s.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            >
              <Star className={`w-3 h-3 ${isFavorite(s.id) ? "fill-primary text-primary opacity-100" : "text-muted-foreground"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
