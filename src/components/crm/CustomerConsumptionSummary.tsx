export function CustomerConsumptionSummary({
  consumption,
}: {
  consumption: {
    barrels: { volume: number; count: number }[];
    topBarrel: { volume: number; count: number } | null;
    avgLitersPerOrder: number;
    totalLiters: number;
  };
}) {
  const { barrels, topBarrel, avgLitersPerOrder, totalLiters } = consumption;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 rounded-md border border-border p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total consumido</span>
          <span className="font-medium">{totalLiters.toLocaleString('pt-BR')} L</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Média por pedido</span>
          <span className="font-medium">
            {avgLitersPerOrder.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Barril mais utilizado</span>
          <span className="font-medium">
            {topBarrel ? `${topBarrel.volume}L (${topBarrel.count})` : '—'}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Barris por tamanho
        </p>
        {barrels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum barril registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {barrels.map((b) => (
              <li key={b.volume} className="flex justify-between">
                <span>{b.volume}L</span>
                <span className="font-medium">
                  {b.count} {b.count === 1 ? 'barril' : 'barris'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
