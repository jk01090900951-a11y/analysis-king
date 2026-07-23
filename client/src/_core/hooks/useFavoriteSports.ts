import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "analysisking_favorite_sports";

// 회원가입이 없는 구조라 서버가 아닌 이 브라우저(기기)에만 저장됩니다.
// 다른 기기/브라우저에서는 즐겨찾기가 이어지지 않는다는 점을 UI에서 안내해주는 게 좋습니다.
export function useFavoriteSports() {
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      // localStorage 접근 불가(사파리 시크릿모드 등) 시 그냥 빈 배열로 시작
    }
  }, []);

  const persist = useCallback((next: number[]) => {
    setFavorites(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 화면 동작에는 지장 없도록 무시
    }
  }, []);

  const toggle = useCallback((sportId: number) => {
    persist(favorites.includes(sportId) ? favorites.filter((id) => id !== sportId) : [...favorites, sportId]);
  }, [favorites, persist]);

  const isFavorite = useCallback((sportId: number) => favorites.includes(sportId), [favorites]);

  return { favorites, toggle, isFavorite };
}
