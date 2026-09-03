import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Copy, Check, AlertCircle } from 'lucide-react';
import {
  CRM_ACTIONS,
  CRM_TONES,
  CRM_LENGTHS,
  USER_INSTRUCTION_MAX,
  type CRMActionId,
  type CRMTone,
  type CRMLength,
} from '@/lib/crm/intelligenceConfig';
import { useCustomerIntelligence } from '@/hooks/useCustomerIntelligence';
import { toast } from 'sonner';

interface Props {
  customerId: string;
}

export function CustomerIntelligencePanel({ customerId }: Props) {
  const [action, setAction] = useState<CRMActionId>('insights');
  const [tone, setTone] = useState<CRMTone>('cordial');
  const [length, setLength] = useState<CRMLength>('medio');
  const [instruction, setInstruction] = useState('');
  const [copied, setCopied] = useState(false);

  const mutation = useCustomerIntelligence();

  const handleGenerate = () => {
    setCopied(false);
    mutation.mutate({
      customer_id: customerId,
      action,
      tone: action === 'whatsapp' ? tone : undefined,
      length: action === 'whatsapp' ? length : undefined,
      user_instruction: instruction.trim() ? instruction.trim() : undefined,
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copiado para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const result = mutation.data?.result as any;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Copiloto Comercial (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo de análise</Label>
            <Select value={action} onValueChange={(v) => setAction(v as CRMActionId)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_ACTIONS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action === 'whatsapp' && (
            <>
              <div>
                <Label>Tom</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as CRMTone)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_TONES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tamanho</Label>
                <Select value={length} onValueChange={(v) => setLength(v as CRMLength)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_LENGTHS.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div>
          <Label>Orientação adicional (opcional)</Label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value.slice(0, USER_INSTRUCTION_MAX))}
            placeholder="Ex: focar em reativação para eventos de fim de ano"
            className="mt-1"
            rows={2}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {instruction.length}/{USER_INSTRUCTION_MAX} caracteres. Dados pessoais não são
            enviados para a IA.
          </p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={mutation.isPending}
          className="w-full sm:w-auto"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {mutation.isPending ? 'Gerando análise...' : 'Gerar análise'}
        </Button>

        {mutation.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {mutation.isError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{mutation.error.message}</span>
          </div>
        )}

        {mutation.isSuccess && result && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            {action === 'insights' && <InsightsView data={result} onCopy={handleCopy} copied={copied} />}
            {action === 'opportunities' && (
              <OpportunitiesView data={result} onCopy={handleCopy} copied={copied} />
            )}
            {action === 'whatsapp' && (
              <WhatsappView data={result} onCopy={handleCopy} copied={copied} />
            )}
            {mutation.data?.context_stats && (
              <p className="text-xs text-muted-foreground">
                Baseado em {mutation.data.context_stats.orders_considered} pedido(s) válido(s).
                {mutation.data.context_stats.cancelled_ignored > 0 &&
                  ` ${mutation.data.context_stats.cancelled_ignored} cancelado(s) ignorado(s).`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CopyButton({ onCopy, copied, text }: { onCopy: (t: string) => void; copied: boolean; text: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => onCopy(text)}>
      {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
      Copiar
    </Button>
  );
}

function InsightsView({ data, onCopy, copied }: any) {
  const text = [
    data.resumo,
    data.perfil && `Perfil: ${data.perfil}`,
    data.pontos_fortes?.length && `Pontos fortes:\n- ${data.pontos_fortes.join('\n- ')}`,
    data.pontos_atencao?.length && `Pontos de atenção:\n- ${data.pontos_atencao.join('\n- ')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{data.resumo}</p>
        <CopyButton onCopy={onCopy} copied={copied} text={text} />
      </div>
      {data.perfil && <Badge variant="secondary">{data.perfil}</Badge>}
      {data.pontos_fortes?.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Pontos fortes</p>
          <ul className="ml-5 list-disc text-sm text-muted-foreground">
            {data.pontos_fortes.map((p: string, i: number) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {data.pontos_atencao?.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Pontos de atenção</p>
          <ul className="ml-5 list-disc text-sm text-muted-foreground">
            {data.pontos_atencao.map((p: string, i: number) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function OpportunitiesView({ data, onCopy, copied }: any) {
  const text = [
    ...(data.oportunidades ?? []).map(
      (o: any) => `[${o.prioridade?.toUpperCase()}] ${o.titulo}: ${o.descricao}`,
    ),
    data.proxima_acao_sugerida && `\nPróxima ação: ${data.proxima_acao_sugerida}`,
  ]
    .filter(Boolean)
    .join('\n');
  const priColor = (p: string) =>
    p === 'alta' ? 'destructive' : p === 'baixa' ? 'outline' : 'secondary';
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CopyButton onCopy={onCopy} copied={copied} text={text} />
      </div>
      <div className="space-y-2">
        {(data.oportunidades ?? []).map((o: any, i: number) => (
          <div key={i} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Badge variant={priColor(o.prioridade) as any}>{o.prioridade}</Badge>
              <p className="text-sm font-semibold">{o.titulo}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{o.descricao}</p>
          </div>
        ))}
      </div>
      {data.proxima_acao_sugerida && (
        <div className="rounded-md bg-primary/5 p-3 text-sm">
          <span className="font-semibold">Próxima ação: </span>
          {data.proxima_acao_sugerida}
        </div>
      )}
    </div>
  );
}

function WhatsappView({ data, onCopy, copied }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap text-sm">{data.mensagem}</p>
        <CopyButton onCopy={onCopy} copied={copied} text={data.mensagem} />
      </div>
      {data.observacao && (
        <p className="text-xs italic text-muted-foreground">{data.observacao}</p>
      )}
    </div>
  );
}
