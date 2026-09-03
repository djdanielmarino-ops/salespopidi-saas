import { Card, CardContent } from '@/components/ui/card';
import type { CustomerMetrics as Metrics } from '@/hooks/useCustomerHistory';
import {
  ShoppingBag,
  CircleDollarSign,
  Beer,
  Receipt,
  CalendarClock,
  TrendingUp,
  AlertCircle,
  XCircle,
} from 'lucide-react';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const liters = (n: number) => `${n.toLocaleString('pt-BR')} L`;
const fdate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const color =
    tone === 'warn'
      ? 'text-amber-600'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-primary';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md bg-muted p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomerMetricsCards({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <MetricCard label="Total de pedidos" value={String(metrics.totalOrders)} icon={ShoppingBag} />
      <MetricCard label="Total pago" value={brl(metrics.totalPaid)} icon={CircleDollarSign} />
      <MetricCard label="Litros consumidos" value={liters(metrics.totalLiters)} icon={Beer} />
      <MetricCard label="Ticket médio" value={brl(metrics.averageTicket)} icon={Receipt} />
      <MetricCard label="Última compra" value={fdate(metrics.lastPurchaseDate)} icon={CalendarClock} />
      <MetricCard label="Maior compra" value={brl(metrics.largestOrderValue)} icon={TrendingUp} />
      <MetricCard label="Valor pendente" value={brl(metrics.totalPending)} icon={AlertCircle} tone="warn" />
      <MetricCard label="Pedidos cancelados" value={String(metrics.cancelledOrders)} icon={XCircle} tone="danger" />
    </div>
  );
}
