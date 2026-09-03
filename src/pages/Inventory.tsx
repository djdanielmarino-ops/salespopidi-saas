import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTaps, useCylinders, useBeerTypes } from '@/hooks/useEquipment';
import { useBarrelSummary, useBarrelInventory } from '@/hooks/useBarrelInventory';
import { EquipmentMapCard } from '@/components/inventory/EquipmentMapCard';
import { Beer, Package, Cylinder as CylinderIcon, TrendingUp } from 'lucide-react';

export default function Inventory() {
  const { data: taps } = useTaps();
  const { data: cylinders } = useCylinders();
  const { data: beerTypes } = useBeerTypes();
  const { data: barrelSummary } = useBarrelSummary();
  const { data: barrelInventory } = useBarrelInventory();

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
          <h1 className="text-2xl font-bold md:text-3xl text-foreground">Estoque</h1>
          <p className="text-muted-foreground">Visão geral de todos os equipamentos</p>
        </div>

        <EquipmentMapCard />



        {/* Chopeiras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beer className="h-5 w-5 text-amber-500" />
              Chopeiras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-2xl font-bold md:text-3xl">{tapsTotal}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-green-600">{tapsAvailable}</div>
                <div className="text-sm text-muted-foreground">Disponíveis</div>
                <div className="text-xs text-green-600">{((tapsAvailable / tapsTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-amber-600">{tapsInUse}</div>
                <div className="text-sm text-muted-foreground">Em Uso</div>
                <div className="text-xs text-amber-600">{((tapsInUse / tapsTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-red-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-red-600">{tapsMaintenance}</div>
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
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-4">
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-green-600">{barrelTotals?.cheio_loja || 0}</div>
                <div className="text-sm text-muted-foreground">Cheios na Loja</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-amber-600">{barrelTotals?.com_cliente || 0}</div>
                <div className="text-sm text-muted-foreground">Com Cliente</div>
              </div>
              <div className="rounded-lg bg-gray-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-gray-600">{barrelTotals?.vazio_loja || 0}</div>
                <div className="text-sm text-muted-foreground">Vazios na Loja</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-blue-600">{barrelTotals?.na_cervejaria || 0}</div>
                <div className="text-sm text-muted-foreground">Na Cervejaria</div>
              </div>
            </div>

            {/* Barrels by volume */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Por Volume</h4>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
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
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-2xl font-bold md:text-3xl">{cylindersTotal}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-green-600">{cylindersFull}</div>
                <div className="text-sm text-muted-foreground">Cheios</div>
                <div className="text-xs text-green-600">{((cylindersFull / cylindersTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-amber-600">{cylindersWithClient}</div>
                <div className="text-sm text-muted-foreground">Com Cliente</div>
                <div className="text-xs text-amber-600">{((cylindersWithClient / cylindersTotal) * 100 || 0).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-gray-500/10 p-4">
                <div className="text-2xl font-bold md:text-3xl text-gray-600">{cylindersEmpty}</div>
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
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
      </div>
    </MainLayout>
  );
}
