import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Access = {
  userId: string | null;
  isAdmin: boolean;
};

/** Who is signed in and whether they are an administrator. */
export function useAccess() {
  const query = useQuery<Access>({
    queryKey: ["access"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return { userId: null, isAdmin: false };

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      return {
        userId: user.id,
        isAdmin: Boolean(roles?.some((r) => r.role === "admin")),
      };
    },
  });

  return {
    userId: query.data?.userId ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    isLoading: query.isLoading,
  };
}
