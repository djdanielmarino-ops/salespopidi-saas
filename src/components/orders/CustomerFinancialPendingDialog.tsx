import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CustomerPendingOrder } from '@/lib/customerFinancialPending';

interface CustomerFinancialPendingDialogProps {
  open: boolean;
  customerName?: string;
  orders: CustomerPendingOrder[];
  isContinuing?: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void | Promise<void>;
}

const brl = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const purchaseDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');

export function CustomerFinancialPendingDialog({
  open,
  customerName,
  orders,
  isContinuing = false,
  onOpenChange,
  onContinue,
}: CustomerFinancialPendingDialogProps) {
  const totalPending = orders.reduce((sum, order) => sum + order.pending, 0);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isContinuing && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Pendência financeira
          </DialogTitle>
          <DialogDescription>
            {customerName ? `${customerName} possui` : 'Este cliente possui'} pedidos anteriores com saldo em aberto.
            O aviso não impede a operação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">Total em aberto</p>
            <p className="text-xl font-semibold text-amber-900">{brl(totalPending)}</p>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">Pedido #{order.orderNumber}</p>
                  <p className="text-muted-foreground">Compra em {purchaseDate(order.purchaseDate)}</p>
                </div>
                <p className="font-semibold text-amber-800">{brl(order.pending)}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isContinuing} onClick={() => onOpenChange(false)}>
            Voltar e revisar
          </Button>
          <Button type="button" disabled={isContinuing} onClick={onContinue}>
            {isContinuing ? 'Continuando...' : 'Continuar mesmo assim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

