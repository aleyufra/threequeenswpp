import { getSession } from "@/lib/session";
import { parseBusinessHours, parseBusinessInfo, parseServices } from "@/lib/agent/config";
import { pageTitleClass } from "@/components/ui";
import { AgentForm } from "./agent-form";
import { Sandbox } from "./sandbox";

export default async function PersonalizacionPage() {
  const { supabase, organizationId, org } = await getSession();
  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (!config) {
    return <p className="text-sm text-danger">Tu organización no tiene configuración del asistente.</p>;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={pageTitleClass}>Personalización</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Lo que escribas aquí es lo que el asistente sabe de tu negocio y cómo habla con tus clientes.
          </p>
        </div>
        <Sandbox />
      </div>
      <AgentForm
        initial={{
          system_prompt: config.system_prompt,
          tone: config.tone,
          handoff_message: config.handoff_message ?? "",
          ask_new_patient: config.ask_new_patient,
          timezone: org.timezone,
          business_info: parseBusinessInfo(config.business_info),
          services: parseServices(config.services),
          business_hours: parseBusinessHours(config.business_hours),
        }}
      />
    </div>
  );
}
