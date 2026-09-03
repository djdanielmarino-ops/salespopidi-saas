import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmitNFeResult {
  success: boolean;
  async?: boolean;
  message?: string;
  nfe_number?: string | null;
  nfe_key?: string | null;
  error?: string;
  missing?: string[];
  detail?: string;
}

export function useEmitNFe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string): Promise<EmitNFeResult> => {
      const { data, error } = await supabase.functions.invoke('emit-nfe', {
        body: { order_id: orderId },
      });
      if (error) {
        // FunctionsHttpError carries body in context
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx?.body) {
            const text = typeof ctx.body === 'string' ? ctx.body : await new Response(ctx.body).text();
            parsed = JSON.parse(text);
          }
        } catch { /* ignore */ }
        const result: EmitNFeResult = {
          success: false,
          error: parsed?.error || error.message,
          missing: parsed?.missing,
          detail: parsed?.detail,
        };
        throw result;
      }
      return data as EmitNFeResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data.async) {
        toast.info(data.message || 'NFe em processamento.');
      } else {
        toast.success(`NFe emitida${data.nfe_number ? ` (Nº ${data.nfe_number})` : ''}!`);
      }
    },
    onError: (err: EmitNFeResult) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (err.missing && err.missing.length > 0) {
        toast.error(`Campos faltando: ${err.missing.join(', ')}`);
      } else {
        toast.error(err.error || 'Erro ao emitir NFe');
      }
    },
  });
}
