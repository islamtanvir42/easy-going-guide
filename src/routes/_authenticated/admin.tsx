import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { UserMenu } from "@/components/inventory/UserMenu";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useAccess";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin controls — Database Inventory" },
      {
        name: "description",
        content:
          "Administrator area for managing who can use the Oracle inventory, granting admin rights and removing records.",
      },
      { property: "og:title", content: "Admin controls — Database Inventory" },
      {
        property: "og:description",
        content: "Manage people, permissions and records in the Oracle database inventory.",
      },
    ],
  }),
  component: AdminPage,
});

type Person = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading, userId } = useAccess();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, isLoading, navigate]);

  const people = useQuery({
    queryKey: ["admin", "people"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  const roles = useQuery({
    queryKey: ["admin", "roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const databases = useQuery({
    queryKey: ["admin", "databases"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("databases")
        .select("id, instance_name, oracle_version")
        .order("instance_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setAdmin = useMutation({
    mutationFn: async ({ id, makeAdmin }: { id: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", id)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });

  const removeDatabase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("databases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "databases"] });
      queryClient.invalidateQueries({ queryKey: ["databases"] });
    },
  });

  const adminIds = new Set(
    (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
  );

  if (isLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin controls</h1>
            <p className="text-xs text-muted-foreground">
              Only administrators can open this page.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Dashboard
            </Link>
            <Link to="/approvals" className="text-sm text-primary hover:underline">
              Access requests
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <section className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">People and permissions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Members can add databases and update versions. Administrators can also approve
              people and delete records.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Access</th>
                <th className="px-4 py-2 font-medium">Level</th>
                <th className="px-4 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {(people.data ?? []).map((p) => {
                const admin = adminIds.has(p.id);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3">{admin ? "Administrator" : "Member"}</td>
                    <td className="px-4 py-3 text-right">
                      {p.id === userId ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setAdmin.isPending}
                          onClick={() => setAdmin.mutate({ id: p.id, makeAdmin: !admin })}
                        >
                          {admin ? "Remove admin" : "Make admin"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">Remove databases</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deleting a database also removes its history, datasets and usage readings.
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(databases.data ?? []).map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="tech px-4 py-3 font-medium">{d.instance_name}</td>
                  <td className="tech px-4 py-3 text-muted-foreground">{d.oracle_version}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removeDatabase.isPending}
                      onClick={() => removeDatabase.mutate(d.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
