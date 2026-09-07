import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pending")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Access pending — Database Inventory" },
      {
        name: "description",
        content:
          "Your access request to the Oracle database inventory is waiting for an administrator to approve it.",
      },
      { property: "og:title", content: "Access pending — Database Inventory" },
      {
        property: "og:description",
        content: "Access to the Oracle database inventory requires administrator approval.",
      },
    ],
  }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "pending" | "rejected">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;
      if (profile?.status === "approved") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setState(profile?.status === "rejected" ? "rejected" : "pending");
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        {state === "rejected" ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Access declined</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your request to use the database inventory was not approved. Contact the
              administrator if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Waiting for approval</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account has been created, but an administrator has to approve it before you can
              open the inventory. You will be able to sign in as soon as that happens.
            </p>
          </>
        )}
        <Button variant="outline" className="mt-6" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
