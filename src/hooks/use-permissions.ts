import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { canAccess, canDo, type ACTIONS, type AppRole } from "@/lib/permissions";

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [] as AppRole[];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const roles = data ?? [];

  return {
    roles,
    isLoading,
    isAdmin: roles.includes("admin"),
    can: (path: string) => canAccess(path, roles),
    canDo: (action: keyof typeof ACTIONS) => canDo(action, roles),
  };
}
