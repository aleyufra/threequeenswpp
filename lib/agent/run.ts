import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, hasToolCall, stepCountIs, type ModelMessage } from "ai";
import { log, errorMessage } from "@/lib/log";
import type { AgentContext } from "./context";
import { buildSystemPrompt } from "./prompt";
import { createTools } from "./tools";

export const AGENT_MODEL = "claude-haiku-5-5";

export type AgentRunResult = {
  text: string;
  handoff: boolean;
  toolCalls: { name: string; ok: boolean }[];
};

export async function runAgent(params: {
  ctx: AgentContext;
  messages: ModelMessage[];
  greet: boolean;
}): Promise<AgentRunResult> {
  const { ctx, messages, greet } = params;

  const result = await generateText({
    model: anthropic(AGENT_MODEL),
    system: buildSystemPrompt({ settings: ctx.settings, contact: ctx.contact, greet }),
    messages,
    tools: createTools(ctx),
    // varias rondas de tool-use; tras el handoff no hace falta otra llamada al modelo
    stopWhen: [stepCountIs(8), hasToolCall("request_human_handoff")],
  });

  const toolCalls: AgentRunResult["toolCalls"] = [];
  for (const step of result.steps) {
    for (const part of step.content) {
      if (part.type === "tool-result") toolCalls.push({ name: part.toolName, ok: true });
      if (part.type === "tool-error") {
        toolCalls.push({ name: part.toolName, ok: false });
        log("error", "agent.tool_error", {
          organization_id: ctx.settings.organizationId,
          conversation_id: ctx.conversationId,
          tool: part.toolName,
          error: errorMessage(part.error),
        });
      }
    }
  }

  // Sin negritas de WhatsApp aunque el modelo las use
  const text = result.text.replace(/\*([^*\n]+)\*/g, "$1").trim();
  return { text, handoff: ctx.state.handoff, toolCalls };
}
