import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTaps, useCylinders, useBeerTypes } from '@/hooks/useEquipment';
import { useBarrelSummary, useBarrelInventory } from '@/hooks/useBarrelInventory';
import { EquipmentMapMode, summarizeOrderItems, useEquipmentMap } from '@/hooks/useEquipmentMap';
import { OrderDetailsDialog } from '@/components/dashboard/OrderDetailsDialog';
import { Beer, CalendarDays, Eye, Package, Cylinder as CylinderIcon, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Inventory() {
  const [mapDate, setMapDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapMode, setMapMode] = useState<EquipmentMapMode>('departures');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const { data: taps } = useTaps();
  const { data: cylinders } = useCylinders();
  const { data: beerTypes } = useBeerTypes();
  const { data: barrelSummary } = useBarrelSummary();
  const { data: barrelInventory } = useBarrelInventory();
  const { data: equipmentMap, isLoading: loadingEquipmentMap } = useEquipmentMap(mapDate, mapMode);

  // Calculate totals
  const tapsTotal = taps?.length || 0;
  const tapsAvailable = taps?.filter(t => t.status === 'disponivel').length || 0;
  const tapsInUse = taps?.filter(t => t.status === 'em_uso').length || 0;
  const tapsMaintenance = taps?.filter(t => t.status === 'manutencao').length || 0;

  // Barrel totals from summary
  const barrelTotals = barrelSummary?.reduce((acc, s) => ({
    cheio_loja: acc.cheio_loja + s.cheio_loja,
    com_cliente: acc.com_cliente + s.com_cliente,
    vazio_loja: acc.vazio_loja + s.vazio_loja,
    na_cervejaria: acc.na_cervejaria + s.na_cervejaria,
  }), { cheio_loja: 0, com_cliente: 0, vazio_loja: 0, na_cervejaria: 0 });

  const cylindersTotal = cylinders?.length || 0;
  const cylindersFull = cylinders?.filter(c => c.status === 'cheio').length || 0;
  const cylindersWithClient = cylinders?.filter(c => c.status === 'com_cliente').length || 0;
  const cylindersEmpty = cylinders?.filter(c => c.status === 'vazio').length || 0;

  const openOrder = (order: any) => {
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  // Calculate chopp available by type from barrel inventory
  const choppByType = beerTypes?.map(type => {
    const typeInventory = barrelInventory?.filter(
      b => b.beer_type_id === type.id && b.status === 'cheio_loja'
    ) || [];
    const totalLiters = typeInventory.reduce((sum, b) => {
      const volume = b.barrel_models?.volume || 0;
      return sum + (volume * b.quantity);
    }, 0);
    const totalBarrels = typeInventory.reduce((sum, b) => sum + b.quantity, 0);
    return {
      ...type,
      barrels: totalBarrels,
      liters: totalLiters,
    };
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estoque</h1>
          <p className="text-muted-foreground">Visão geral de todos os equipamentos</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Mapa de Saídas
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Controle visual por data: chopeira, cliente, pedido e chopp reservado.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_220px]">
                <div className="space-y-2">
                  <Label htmlFor="equipment-map-date">Data</Label>
                  <Input
                    id="equipment-map-date"
                    type="date"
                    value={mapDate}
                    onChange={(event) => setMapDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Visualização</Label>
                  <Select value={mapMode} onValueChange={(value) => setMapMode(value as EquipmentMapMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="departures">Saídas do dia</SelectItem>
                      <SelectItem value="occupied">Ocupadas na data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{equipmentMap?.summary.tapsOccupied || 0}</div>
                <div className="text-sm text-muted-foreground">
                  {mapMode === 'departures' ? 'Chopeiras saindo' : 'Chopeiras ocupadas'}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold text-green-600">{equipmentMap?.summary.tapsAvailable || 0}</div>
                <div className="text-sm text-muted-foreground">Livres na data</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold text-red-600">{equipmentMap?.summary.tapsMaintenance || 0}</div>
                <div className="text-sm text-muted-foreground">Manutenção</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{equipmentMap?.orders.length || 0}</div>
                <div className="text-sm text-muted-foreground">Pedidos no mapa</div>
              </div>
            </div>

            {equipmentMap?.summary.litersByBeer && Object.keys(equipmentMap.summary.litersByBeer).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(equipmentMap.summary.litersByBeer).map(([beerName, liters]) => (
                  <Badge key={beerName} variant="outline" className="px-3 py-1">
                    {beerName}: {liters}L
                  </Badge>
                ))}
              </div>
            )}

            {equipmentMap?.ordersWithoutTap && equipmentMap.ordersWithoutTap.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-500/10 p-3">
                <div className="mb-2 font-medium text-amber-700">Pedidos sem chopeira definida</div>
                <div className="space-y-2">
                  {equipmentMap.ordersWithoutTap.map((order) => (
                    <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        #{order.order_number} - {order.customers?.full_name} - {format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => openOrder(order)}>
                        Abrir pedido
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingEquipmentMap ? (
              <p className="text-muted-foreground">Carregando mapa...</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chopeira</TableHead>
                      <TableHead>Voltagem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cliente / Pedido</TableHead>
                      <TableHead>Chopp</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipmentMap?.rows.map((row) => {
                      const order = row.order;
                      const itemSummary = order ? summarizeOrderItems(order.order_items) : [];
                      const isMaintenance = row.tap.status === 'manutencao';

                      return (
                        <TableRow
                          key={row.tap.id}
                          className={order ? 'bg-amber-500/5' : isMaintenance ? 'bg-red-500/5' : ''}
                        >
                          <TableCell className="font-medium">
                            <div>{row.tap.code}</div>
                            <div className="text-xs text-muted-foreground">{row.tap.tap_types?.name || '-'}</div>
                          </TableCell>
                          <TableCell>{row.tap.voltage || '-'}</TableCell>
                          <TableCell>
                            {order ? (
                              <Badge className="bg-amber-500">Reservada</Badge>
                            ) : isMaintenance ? (
                              <Badge variant="destructive">Manutenção</Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-600 text-green-600">Disponível</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {order ? (
                              <div>
                                <div className="font-medium">{order.customers?.full_name}</div>
                                <div className="text-xs text-muted-foreground">Pedido #{order.order_number}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {itemSummary.length > 0 ? (
                              <div className="space-y-1">
                                {itemSummary.map((item) => (
                                  <div key={item.label} className="text-sm">{item.label}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {order ? format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </TableCell>
                          <TableCell>
                            {order?.expected_return_date
                              ? format(parseISO(order.expected_return_date), 'dd/MM/yyyy', { locale: ptBR })
                              : order ? '-' : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {order ? (
                              <Button variant="outline" size="sm" onClick={() => openOrder(order)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Abrir
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chopeiras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beer className="h-5 w-5 text-amber-500" />
              Chopeiras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-3xl font-bold">{tapsTotal}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-3xl font-bold text-green-600">{tapsAvailable}</div>
                <div className="text-sm text-muted-foreground">Disponíveis</div>
                <div className="text-xs text-green-600">{((tapsAvailable / tapsTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-3xl font-bold text-amber-600">{tapsInUse}</div>
                <div className="text-sm text-muted-foreground">Em Uso</div>
                <div className="text-xs text-amber-600">{((tapsInUse / tapsTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-red-500/10 p-4">
                <div className="text-3xl font-bold text-red-600">{tapsMaintenance}</div>
                <div className="text-sm text-muted-foreground">Manutenção</div>
                <div className="text-xs text-red-600">{((tapsMaintenance / tapsTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barris */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              Barris (Total por Status)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-3xl font-bold text-green-600">{barrelTotals?.cheio_loja || 0}</div>
                <div className="text-sm text-muted-foreground">Cheios na Loja</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-3xl font-bold text-amber-600">{barrelTotals?.com_cliente || 0}</div>
                <div className="text-sm text-muted-foreground">Com Cliente</div>
              </div>
              <div className="rounded-lg bg-gray-500/10 p-4">
                <div className="text-3xl font-bold text-gray-600">{barrelTotals?.vazio_loja || 0}</div>
                <div className="text-sm text-muted-foreground">Vazios na Loja</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-4">
                <div className="text-3xl font-bold text-blue-600">{barrelTotals?.na_cervejaria || 0}</div>
                <div className="text-sm text-muted-foreground">Na Cervejaria</div>
              </div>
            </div>

            {/* Barrels by volume */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Por Volume</h4>
              <div className="grid gap-4 md:grid-cols-5">
                {barrelSummary?.map(item => {
                  const total = item.cheio_loja + item.com_cliente + item.vazio_loja + item.na_cervejaria;
                  return (
                    <div key={item.model.id} className="rounded-lg border p-4">
                      <div className="font-bold text-lg">{item.model.volume}L</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <div className="flex justify-between">
                          <span>Cheios:</span>
                          <span className="text-green-600">{item.cheio_loja}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cliente:</span>
                          <span className="text-amber-600">{item.com_cliente}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vazios:</span>
                          <span className="text-gray-600">{item.vazio_loja}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cervejaria:</span>
                          <span className="text-blue-600">{item.na_cervejaria}</span>
                        </div>
                        <div className="flex justify-between border-t mt-1 pt-1 font-medium">
                          <span>Total:</span>
                          <span>{total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cilindros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CylinderIcon className="h-5 w-5 text-green-500" />
              Cilindros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-3xl font-bold">{cylindersTotal}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-3xl font-bold text-green-600">{cylindersFull}</div>
                <div className="text-sm text-muted-foreground">Cheios</div>
                <div className="text-xs text-green-600">{((cylindersFull / cylindersTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-3xl font-bold text-amber-600">{cylindersWithClient}</div>
                <div className="text-sm text-muted-foreground">Com Cliente</div>
                <div className="text-xs text-amber-600">{((cylindersWithClient / cylindersTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-gray-500/10 p-4">
                <div className="text-3xl font-bold text-gray-600">{cylindersEmpty}</div>
                <div className="text-sm text-muted-foreground">Vazios</div>
                <div className="text-xs text-gray-600">{((cylindersEmpty / cylindersTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chopp Disponível por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Chopp Disponível por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {choppByType?.map((type) => (
                <div key={type.id} className="rounded-lg border p-4">
                  <div className="font-medium">{type.name}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{type.liters}L</span>
                    <span className="text-sm text-muted-foreground">em {type.barrels} barris</span>
                  </div>
                  {type.price_per_liter && (
                    <div className="text-sm text-muted-foreground">
                      R$ {Number(type.price_per_liter).toFixed(2)}/L
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <OrderDetailsDialog
          order={selectedOrder}
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
