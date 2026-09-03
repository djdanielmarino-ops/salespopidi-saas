import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { CustomerOrder } from '@/hooks/useCustomerHistory';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fdate = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—';

const paymentMethodLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  transferencia: 'Transferência',
};

const paymentStatusLabel: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-md border border-border p-3 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export function CustomerOrderDetailsDialog({
  order,
  open,
  onOpenChange,
  paidAmount,
}: {
  order: CustomerOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paidAmount: number;
}) {
  if (!order) return null;
  const total = Number(order.total || 0);
  const pending = Math.max(0, total - paidAmount);

  const addressParts = [
    order.delivery_address_street,
    order.delivery_address_number,
    order.delivery_address_complement,
    order.delivery_address_neighborhood,
    order.delivery_address_city,
    order.delivery_address_state,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedido #{order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Section title="Pedido">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Criado em" value={fdate(order.created_at?.slice(0, 10))} />
              <Field label="Data do evento" value={fdate(order.delivery_date)} />
              <Field label="Horário" value={order.delivery_time?.slice(0, 5) || '—'} />
              <Field label="Status" value={<Badge variant="outline">{order.status}</Badge>} />
              <Field label="Tipo" value={order.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'} />
              <Field label="Observações" value={order.notes || '—'} />
            </dl>
          </Section>

          <Section title="Produtos">
            {(order.order_items ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhum item.</p>
            ) : (
              <ul className="space-y-1">
                {(order.order_items ?? []).map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span>
                      {it.barrel_models?.volume ? `Barril ${it.barrel_models.volume}L` : 'Item'}
                      {' '}
                      × {it.barrel_quantity ?? 1}
                      {' — '}
                      {Number(it.quantity_liters || 0)}L
                    </span>
                    <span className="font-medium">{brl(Number(it.total_price || 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Financeiro">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Subtotal" value={brl(Number(order.subtotal || 0))} />
              <Field label="Entrega" value={brl(Number(order.delivery_fee || 0))} />
              <Field label="Desconto" value={brl(Number(order.discount || 0))} />
              <Field label="Total" value={<span className="font-semibold">{brl(total)}</span>} />
              <Field label="Pago" value={brl(paidAmount)} />
              <Field label="Pendente" value={brl(pending)} />
            </dl>
            {(order.payments ?? []).length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-xs text-muted-foreground">Pagamentos</p>
                <ul className="space-y-1">
                  {(order.payments ?? []).map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>
                        {paymentMethodLabel[p.payment_method] || p.payment_method}
                        {' — '}
                        <Badge variant="outline" className="text-xs">
                          {paymentStatusLabel[p.status] || p.status}
                        </Badge>
                      </span>
                      <span>{brl(Number(p.amount || 0))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Logística">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipo" value={order.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'} />
              <Field
                label="Endereço"
                value={
                  order.delivery_type === 'entrega' && addressParts.length > 0
                    ? addressParts.join(', ')
                    : '—'
                }
              />
              <Field label="Horário" value={order.delivery_time?.slice(0, 5) || '—'} />
            </dl>
          </Section>

          <Section title="Equipamentos">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Chopeira" value={order.taps?.code || '—'} />
              <Field label="Tipo" value={order.taps?.tap_types?.name || '—'} />
              <Field label="Voltagem" value={order.taps?.voltage || '—'} />
              <Field label="Cilindro" value={order.cylinders?.code || '—'} />
              <Field label="Retorno previsto" value={fdate(order.expected_return_date)} />
              <Field label="Retorno efetivo" value={fdate(order.actual_return_date)} />
            </dl>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
