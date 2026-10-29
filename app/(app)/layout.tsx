import { getSession } from "@/lib/session";
import { HandoffListener } from "./handoff-listener";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, org, profile, organizationId } = await getSession();

  const { data: inactive } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("bot_active", false);

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar orgName={org.name} userName={profile.full_name} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-10">{children}</main>
      <HandoffListener organizationId={organizationId} initialInactiveIds={(inactive ?? []).map((c) => c.id)} />
    </div>
  );
}
