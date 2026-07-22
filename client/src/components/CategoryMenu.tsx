import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function CategoryMenu() {
  const { data: sports } = trpc.sport.list.useQuery();
  const [location] = useLocation();

  return (
    <div className="border-b border-border bg-card/50">
      <div className="container flex gap-1 overflow-x-auto py-2 scrollbar-hide">
        <Link href="/matches">
          <a className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${location === "/matches" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            전체
          </a>
        </Link>
        {(sports ?? []).map((s: any) => (
          <Link key={s.id} href={`/matches?sportId=${s.id}`}>
            <a className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
              <span>{s.icon}</span>
              <span>{s.name}</span>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
