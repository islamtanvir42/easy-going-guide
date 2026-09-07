import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { UserMenu } from "@/components/inventory/UserMenu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Access requests — Database Inventory" },
      {
        name: "description",
        content:
          "Review and approve people who requested access to the Oracle database inventory dashboard.",
      },
      { property: "og:title", content: "Access requests — Database Inventory" },
      {
        property: "og:description",
        content: "Approve or decline access requests for the database inventory.",
      },
    ],
  }),
  component: ApprovalsPage,
});

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  team: string | null;
  status: string;
  created_at: string;
};

function ApprovalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (!active) return;
      setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, navigate]);

  const people = useQuery({
    queryKey: ["profiles", "all"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, team, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          approved_by: me.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;

      if (status === "approved") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({ user_id: id, role: "viewer" }, { onConflict: "user_id,role" });
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles", "all"] }),
  });

  const rows = people.data ?? [];
  const pending = rows.filter((p) => p.status === "pending");
  const others = rows.filter((p) => p.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Access requests</h1>
            <p className="text-xs text-muted-foreground">
              Nobody can open the inventory until you approve them here.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting for you ({pending.length})
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Requested</th>
                  <th className="px-4 py-2 font-medium text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {people.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!people.isLoading && pending.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                      No one is waiting for access right now.
                    </td>
                  </tr>
                )}
                {pending.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: p.id, status: "approved" })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: p.id, status: "rejected" })}
                        >
                          Decline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {decide.isError && (
            <p className="mt-2 text-sm text-destructive">
              Could not save that decision. Please try again.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Everyone else
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {others.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                      Nothing here yet.
                    </td>
                  </tr>
                )}
                {others.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: p.id,
                              status: p.status === "approved" ? "rejected" : "approved",
                            })
                          }
                        >
                          {p.status === "approved" ? "Revoke access" : "Approve"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
