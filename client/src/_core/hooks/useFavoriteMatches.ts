import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "analysisking_favorite_matches";

export function useFavoriteMatches() {
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: number[]) => {
    setFavorites(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const toggle = useCallback((matchId: number) => {
    persist(favorites.includes(matchId) ? favorites.filter((id) => id !== matchId) : [...favorites, matchId]);
  }, [favorites, persist]);

  const isFavorite = useCallback((matchId: number) => favorites.includes(matchId), [favorites]);

  return { favorites, toggle, isFavorite };
}
