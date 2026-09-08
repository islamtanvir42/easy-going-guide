import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useAccess";

export function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAccess();
  const [label, setLabel] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;
      setLabel(profile?.display_name || data.user.email || "Signed in");
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    (async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (active) setPendingCount(count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex items-center gap-3">
      <Link to="/manage" className="text-sm text-primary hover:underline">
        Add / update
      </Link>
      {isAdmin && (
        <Link to="/admin" className="text-sm text-primary hover:underline">
          Admin
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
              {pendingCount}
            </span>
          )}
        </Link>
      )}
      {label && (
        <span className="text-xs text-muted-foreground">
          {label} · {isAdmin ? "Administrator" : "Member"}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
