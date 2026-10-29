import type { AgentContext } from "../context";
import { bookAppointmentTool } from "./book-appointment";
import { getAvailableSlotsTool } from "./get-available-slots";
import { requestHumanHandoffTool } from "./request-human-handoff";
import { saveContactInfoTool } from "./save-contact-info";

export function createTools(ctx: AgentContext) {
  return {
    get_available_slots: getAvailableSlotsTool(ctx),
    book_appointment: bookAppointmentTool(ctx),
    save_contact_info: saveContactInfoTool(ctx),
    request_human_handoff: requestHumanHandoffTool(ctx),
  };
}
