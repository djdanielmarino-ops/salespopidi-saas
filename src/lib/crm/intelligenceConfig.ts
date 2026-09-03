// Client-safe options for the AI copilot UI.
// The model name is NEVER declared here — it lives only in the edge function.

export const CRM_ACTIONS = [
  { id: 'insights', label: 'Gerar insights' },
  { id: 'opportunities', label: 'Oportunidades comerciais' },
  { id: 'whatsapp', label: 'Rascunho de WhatsApp' },
] as const;

export type CRMActionId = (typeof CRM_ACTIONS)[number]['id'];

export const CRM_TONES = [
  { id: 'cordial', label: 'Cordial' },
  { id: 'proximo', label: 'Próximo' },
  { id: 'formal', label: 'Formal' },
] as const;

export type CRMTone = (typeof CRM_TONES)[number]['id'];

export const CRM_LENGTHS = [
  { id: 'curto', label: 'Curto' },
  { id: 'medio', label: 'Médio' },
  { id: 'longo', label: 'Longo' },
] as const;

export type CRMLength = (typeof CRM_LENGTHS)[number]['id'];

export const USER_INSTRUCTION_MAX = 400;
