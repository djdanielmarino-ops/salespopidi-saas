import { MapPin } from 'lucide-react';

export function CustomerAddresses({
  addresses,
}: {
  addresses: { display: string; count: number; last: string }[];
}) {
  if (addresses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum endereço de entrega registrado.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {addresses.map((a) => (
        <li
          key={a.display}
          className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm">{a.display}</p>
              <p className="text-xs text-muted-foreground">
                Última utilização:{' '}
                {new Date(a.last + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <span className="whitespace-nowrap text-sm font-medium">
            {a.count}× {a.count === 1 ? 'uso' : 'usos'}
          </span>
        </li>
      ))}
    </ul>
  );
}
