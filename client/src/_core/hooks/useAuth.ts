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
    isAdmin: user?.role === "admin",
    isLoading,
    loading: isLoading, // 일부 컴포넌트에서 loading 이름으로 참조
    logout: () => logoutMutation.mutate(),
  };
}
