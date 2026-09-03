import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OrderDetailsDialog } from '@/components/dashboard/OrderDetailsDialog';
import { CalendarOrder } from '@/hooks/useCalendarOrders';
import {
  useEquipmentMap,
  EquipmentMapMode,
  EquipmentMapOrder,
  summarizeOrderItems,
} from '@/hooks/useEquipmentMap';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Beer } from 'lucide-react';

const statusLabels: Record<string, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  manutencao: 'Manutenção',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

export function EquipmentMapCard() {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState<EquipmentMapMode>('departures');
  const [selectedOrder, setSelectedOrder] = useState<EquipmentMapOrder | null>(null);
  const { data, isLoading } = useEquipmentMap(selectedDate, mode);

  const rows = data?.rows || [];
  const ordersWithoutTap = data?.ordersWithoutTap || [];
  const summary = data?.summary;

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Mapa de Saídas
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[170px]"
            />
            <Tabs value={mode} onValueChange={(v) => setMode(v as EquipmentMapMode)}>
              <TabsList>
                <TabsTrigger value="departures">Saídas do dia</TabsTrigger>
                <TabsTrigger value="occupied">Ocupadas na data</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Chopeiras: {summary.tapsTotal}</Badge>
            <Badge variant="secondary">Ocupadas: {summary.tapsOccupied}</Badge>
            <Badge variant="secondary">Livres: {summary.tapsAvailable}</Badge>
            <Badge variant="secondary">Manutenção: {summary.tapsMaintenance}</Badge>
            {Object.entries(summary.litersByBeer).map(([beer, liters]) => (
              <Badge key={beer} variant="outline" className="gap-1">
                <Beer className="h-3 w-3" />
                {beer}: {liters}L
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {ordersWithoutTap.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pedidos sem chopeira definida</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2">
                {ordersWithoutTap.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      #{order.order_number} — {order.customers?.full_name || 'Cliente'} — entrega{' '}
                      {formatDate(order.delivery_date)}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                      Abrir
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chopeira cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Chopeira</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Voltagem</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Pedido</th>
                  <th className="py-2 pr-3">Chopp</th>
                  <th className="py-2 pr-3">Barris</th>
                  <th className="py-2 pr-3">Litros</th>
                  <th className="py-2 pr-3">Entrega</th>
                  <th className="py-2 pr-3">Retorno</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tap, order }) => {
                  const items = summarizeOrderItems(order?.order_items);
                  const barrels = items.reduce((sum, i) => sum + i.barrels, 0);
                  const liters = items.reduce((sum, i) => sum + i.liters, 0);
                  return (
                    <tr key={tap.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 font-medium">{tap.code}</td>
                      <td className="py-2 pr-3">{tap.tap_types?.name || '-'}</td>
                      <td className="py-2 pr-3">{tap.voltage || '-'}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={
                            tap.status === 'manutencao'
                              ? 'destructive'
                              : order
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {tap.status === 'manutencao'
                            ? statusLabels.manutencao
                            : order
                              ? 'Ocupada'
                              : 'Livre'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{order?.customers?.full_name || '-'}</td>
                      <td className="py-2 pr-3">{order ? `#${order.order_number}` : '-'}</td>
                      <td className="py-2 pr-3">
                        {items.length > 0
                          ? items.map((i) => <div key={i.beerName}>{i.label}</div>)
                          : '-'}
                      </td>
                      <td className="py-2 pr-3">{order ? barrels : '-'}</td>
                      <td className="py-2 pr-3">{order ? `${liters}L` : '-'}</td>
                      <td className="py-2 pr-3">{order ? formatDate(order.delivery_date) : '-'}</td>
                      <td className="py-2 pr-3">
                        {order ? formatDate(order.expected_return_date || order.delivery_date) : '-'}
                      </td>
                      <td className="py-2">
                        {order && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                            Abrir
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <OrderDetailsDialog
        order={(selectedOrder as CalendarOrder) || null}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      />
    </Card>
  );
}
