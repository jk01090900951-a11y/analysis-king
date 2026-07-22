import { trpc } from "@/lib/trpc";

export function useAuth() {
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); window.location.href = "/"; },
  });
  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isAdmin: !!user, // 2026: 로그인 자체가 관리자 전용이라 로그인 여부 = 관리자 여부
    isLoading,
    loading: isLoading, // 일부 컴포넌트에서 loading 이름으로 참조
    logout: () => logoutMutation.mutate(),
  };
}
