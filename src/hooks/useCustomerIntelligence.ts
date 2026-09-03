import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CRMActionId, CRMTone, CRMLength } from '@/lib/crm/intelligenceConfig';

export interface IntelligenceRequest {
  customer_id: string;
  action: CRMActionId;
  user_instruction?: string;
  tone?: CRMTone;
  length?: CRMLength;
}

export interface IntelligenceResponse {
  action: CRMActionId;
  model: string;
  result: unknown;
  context_stats?: {
    orders_considered: number;
    cancelled_ignored: number;
    payments_ignored: number;
  };
}

export function useCustomerIntelligence() {
  return useMutation<IntelligenceResponse, Error, IntelligenceRequest>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('customer-intelligence', {
        body: payload,
      });
      if (error) {
        // Try to extract friendly message from function response
        let msg = 'Não foi possível gerar a análise agora.';
        try {
          const ctx = (error as unknown as { context?: { text?: () => Promise<string> } }).context;
          const text = ctx?.text ? await ctx.text() : null;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed?.error) msg = String(parsed.error);
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      if (!data) throw new Error('Resposta vazia da IA.');
      return data as IntelligenceResponse;
    },
  });
}
