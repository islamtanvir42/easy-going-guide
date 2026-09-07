import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Database Inventory — Oracle Estate Tracking" },
      {
        name: "description",
        content:
          "Secure internal inventory for Oracle databases and servers: versions, environments, resource usage, scan coverage and expiry alerts.",
      },
      { property: "og:title", content: "Database Inventory — Oracle Estate Tracking" },
      {
        property: "og:description",
        content:
          "Sign in to track Oracle databases and servers, resource usage and lifecycle expiry alerts.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <main className="max-w-xl text-center">
        <p className="tech text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Internal tooling
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Database Inventory — Oracle Estate Tracking</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          A single view of every Oracle instance across your servers — versions and
          end-of-life flags, environments, schemas, resource usage and lifecycle expiry
          alerts. Access is restricted to authorised users.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          {signedIn ? (
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
