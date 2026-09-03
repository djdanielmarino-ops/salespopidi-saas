export function CustomerEquipmentHistory({
  equipment,
}: {
  equipment: { type: string; voltage: string | null; count: number; last: string }[];
}) {
  if (equipment.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma chopeira utilizada.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {equipment.map((e) => (
        <li
          key={`${e.type}-${e.voltage ?? ''}`}
          className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
        >
          <div>
            <p className="text-sm font-medium">
              {e.type}
              {e.voltage ? ` — ${e.voltage}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Última:{' '}
              {new Date(e.last + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className="text-sm font-medium">
            {e.count} {e.count === 1 ? 'utilização' : 'utilizações'}
          </span>
        </li>
      ))}
    </ul>
  );
}
