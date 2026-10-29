// Subconjunto del payload de webhooks de WhatsApp Cloud API que usamos.

export type WebhookPayload = {
  object?: string;
  entry?: WebhookEntry[];
};

export type WebhookEntry = {
  id: string;
  changes?: WebhookChange[];
};

export type WebhookChange = {
  field: string;
  value: WebhookValue;
};

export type WebhookValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: InboundMessage[];
  statuses?: MessageStatus[];
};

export type InboundMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: {
    button_reply?: { title: string };
    list_reply?: { title: string };
  };
};

export type MessageStatus = {
  id: string;
  status: string;
  recipient_id: string;
  errors?: { code: number; title: string }[];
};
