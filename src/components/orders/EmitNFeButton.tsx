import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Receipt, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Order, Customer, OrderItem, Payment } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { validateOrderForNFe } from '@/lib/nfeValidation';
import { useEmitNFe } from '@/hooks/useEmitNFe';

interface EmitNFeButtonProps {
  order: Order;
}

type Step = 'idle' | 'validation_failed' | 'confirm1' | 'confirm2' | 'confirm_retry';

export function EmitNFeButton({ order }: EmitNFeButtonProps) {
  const [step, setStep] = useState<Step>('idle');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [retryConfirmed, setRetryConfirmed] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const emit = useEmitNFe();

  useEffect(() => {
    let active = true;
    (async () => {
      const [c, i, p] = await Promise.all([
        supabase.from('customers').select('*').eq('id', order.customer_id).maybeSingle(),
        supabase.from('order_items').select('*, beer_types(*)').eq('order_id', order.id),
        supabase.from('payments').select('*').eq('order_id', order.id),
      ]);
      if (!active) return;
      setCustomer((c.data as Customer) || null);
      setItems((i.data as OrderItem[]) || []);
      setPayments((p.data as Payment[]) || []);
    })();
    return () => { active = false; };
  }, [order.id, order.customer_id, order.nfe_status]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const isPaid = Number(order.total) > 0 && totalPaid >= Number(order.total);
  // Elegibilidade exclusivamente financeira: pedido pago e não cancelado.
  // Independe de status de equipamentos/logística (pode emitir antes da devolução).
  const eligible = order.status !== 'cancelado' && isPaid;

  if (!eligible) return null;

  const status = order.nfe_status;

  // ----- Visual states -----
  if (status === 'emitida') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-green-600 hover:bg-green-600 gap-1">
              <CheckCircle2 className="h-3 w-3" /> NFe emitida
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-0.5">
              {order.nfe_number && <div>Nº: {order.nfe_number}</div>}
              {order.nfe_key && <div className="break-all max-w-xs">Chave: {order.nfe_key}</div>}
              {order.nfe_issued_at && (
                <div>Emitida em {format(parseISO(order.nfe_issued_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'emitindo') {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Processando NFe...
      </Button>
    );
  }

  const isRetry = status === 'erro';

  const openFlow = () => {
    const v = validateOrderForNFe(order, customer, items, totalPaid);
    if (!v.valid) {
      setMissing(v.missing);
      setStep('validation_failed');
      return;
    }
    setStep('confirm1');
  };

  const doEmit = () => {
    setStep('idle');
    setRetryConfirmed(false);
    emit.mutate(order.id);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={openFlow}
              disabled={emit.isPending}
              className={
                isRetry
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1'
                  : 'bg-orange-500 hover:bg-orange-600 text-white gap-1'
              }
            >
              {isRetry ? <AlertTriangle className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
              {isRetry ? 'Tentar emitir novamente' : 'Emitir NFe'}
            </Button>
          </TooltipTrigger>
          {isRetry && order.nfe_error_message && (
            <TooltipContent>
              <div className="text-xs max-w-xs space-y-1">
                <div className="font-medium">Última tentativa falhou:</div>
                <div className="text-muted-foreground">{order.nfe_error_message}</div>
                <div className="text-amber-600">⚠️ Confirme no n8n se a NFe não foi gerada antes de tentar novamente.</div>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Validation failure */}
      <AlertDialog open={step === 'validation_failed'} onOpenChange={(o) => !o && setStep('idle')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível emitir a NFe</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Os seguintes dados estão faltando ou inválidos:</p>
                <ul className="list-disc pl-5 text-sm">
                  {missing.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm 1 */}
      <AlertDialog open={step === 'confirm1'} onOpenChange={(o) => { if (!o) setStep((s) => s === 'confirm1' ? 'idle' : s); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir NFe do pedido #{order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              A NFe será emitida com os dados atuais do pedido e do cliente. Esta ação aciona o sistema fiscal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setStep('confirm2'); }}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm 2 */}
      <AlertDialog open={step === 'confirm2'} onOpenChange={(o) => { if (!o) setStep((s) => s === 'confirm2' ? 'idle' : s); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação final</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja emitir a NFe? <strong>Esta ação não pode ser desfeita</strong> e a nota será registrada no sistema fiscal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                if (isRetry) {
                  e.preventDefault();
                  setStep('confirm_retry');
                } else {
                  doEmit();
                }
              }}
            >
              {isRetry ? 'Continuar' : 'Sim, emitir NFe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm retry (extra) */}
      <AlertDialog open={step === 'confirm_retry'} onOpenChange={(o) => { if (!o) setStep((s) => { if (s === 'confirm_retry') { setRetryConfirmed(false); return 'idle'; } return s; }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Atenção: risco de duplicidade</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  A tentativa anterior falhou, mas a NFe pode ter sido emitida mesmo assim no sistema fiscal.
                  Reemitir agora pode gerar nota duplicada.
                </p>
                <label className="flex items-start gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <Checkbox
                    checked={retryConfirmed}
                    onCheckedChange={(v) => setRetryConfirmed(v === true)}
                    className="mt-0.5"
                  />
                  <span>Você confirmou no sistema fiscal que a NFe não foi emitida anteriormente?</span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!retryConfirmed}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={doEmit}
            >
              Confirmo e quero reemitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
