export interface BarrelDailySummaryRow {
  volume: number;
  initialBreweryStock: number;
  receivedFromBrewery: number;
  sentToBrewery: number;
  currentBreweryStock: number;
}

interface Movement {
  barrel_model_id: string;
  movement_type: 'received' | 'sent';
  quantity: number;
}

interface ModelStock {
  id: string;
  volume: number;
  currentBreweryStock: number;
}

export function buildBarrelDailySummary(models: ModelStock[], movements: Movement[]): BarrelDailySummaryRow[] {
  return models
    .map((model) => {
      const modelMovements = movements.filter((item) => item.barrel_model_id === model.id);
      const receivedFromBrewery = modelMovements
        .filter((item) => item.movement_type === 'received')
        .reduce((total, item) => total + item.quantity, 0);
      const sentToBrewery = modelMovements
        .filter((item) => item.movement_type === 'sent')
        .reduce((total, item) => total + item.quantity, 0);

      return {
        volume: model.volume,
        initialBreweryStock: model.currentBreweryStock - sentToBrewery + receivedFromBrewery,
        receivedFromBrewery,
        sentToBrewery,
        currentBreweryStock: model.currentBreweryStock,
      };
    })
    .sort((a, b) => a.volume - b.volume);
}

export function formatBarrelSummaryMessage(date: Date, rows: BarrelDailySummaryRow[]): string {
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
  const lines = rows.map((row) =>
    `${row.volume}L | Anterior: ${row.initialBreweryStock} | Recebidos: ${row.receivedFromBrewery} | Enviados: ${row.sentToBrewery} | Atual: ${row.currentBreweryStock}`,
  );
  return [`*CONTROLE DE BARRIS — CERVEJARIA*`, formattedDate, '', ...lines].join('\n');
}
