import type { WhatsAppCredentials } from "@/lib/whatsapp/config";
import type { AgentSettings } from "./config";

export type AgentMode = "live" | "sandbox";

export type AgentContact = {
  id: string | null;
  phone: string | null;
  fullName: string | null;
  isNewPatient: boolean | null;
};

// Contexto compartido por las tools durante una ejecución del agente.
export type AgentContext = {
  mode: AgentMode;
  settings: AgentSettings;
  contact: AgentContact;
  conversationId: string | null;
  // sólo en modo live
  whatsapp: WhatsAppCredentials | null;
  state: { handoff: boolean };
};
