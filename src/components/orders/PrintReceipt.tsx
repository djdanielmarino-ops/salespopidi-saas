import { Order, OrderItem, Payment } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { escapeHtml as e } from '@/lib/escapeHtml';

interface PrintReceiptProps {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
}

export function PrintReceipt({ order, items, payments }: PrintReceiptProps) {
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remaining = Number(order.total) - totalPaid;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const paymentMethodLabels: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      cartao_debito: 'Cartão Débito',
      cartao_credito: 'Cartão Crédito',
      transferencia: 'Transferência',
    };

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo - Pedido #${e(order.order_number)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }
          h2 { text-align: center; font-size: 14px; margin-bottom: 20px; color: #666; }
          .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 12px; }
          .row.bold { font-weight: bold; }
          .section-title { font-weight: bold; margin: 10px 0 5px; font-size: 13px; }
          .items { margin: 10px 0; }
          .item { font-size: 11px; margin: 3px 0; }
          .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>CHOPPCONTROL</h1>
        <h2>Recibo de Venda</h2>
        
        <div class="divider"></div>
        
        <div class="row bold"><span>Pedido:</span> <span>#${e(order.order_number)}</span></div>
        <div class="row"><span>Data:</span> <span>${format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
        <div class="row"><span>Tipo:</span> <span>${order.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}</span></div>
        
        ${order.delivery_type === 'entrega' && order.delivery_address_street ? `
        <div class="divider"></div>
        <div class="section-title">ENDEREÇO DE ENTREGA</div>
        <div class="row"><span>${e(order.delivery_address_street)}, ${e(order.delivery_address_number || 'S/N')}${order.delivery_address_complement ? ' - ' + e(order.delivery_address_complement) : ''}</span></div>
        <div class="row"><span>${e(order.delivery_address_neighborhood || '')}${order.delivery_address_city ? ' - ' + e(order.delivery_address_city) : ''}${order.delivery_address_state ? '/' + e(order.delivery_address_state) : ''}</span></div>
        ${order.delivery_address_zip_code ? `<div class="row"><span>CEP: ${e(order.delivery_address_zip_code)}</span></div>` : ''}
        ` : ''}
        
        <div class="divider"></div>
        
        <div class="section-title">CLIENTE</div>
        <div class="row"><span>${e(order.customers?.full_name)}</span></div>
        <div class="row"><span>${e(order.customers?.phone)}</span></div>
        ${order.customers?.email ? `<div class="row"><span>${e(order.customers?.email)}</span></div>` : ''}
        
        <div class="divider"></div>
        
        <div class="section-title">ITENS</div>
        <div class="items">
          ${items.map(item => {
            const volume = item.barrel_models?.volume || Math.round(item.quantity_liters / (item.barrel_quantity || 1));
            return `
            <div class="item">
              <div class="row">
                <span>${e(item.beer_types?.name)} (${e(volume)}L)</span>
                <span>${e(item.barrel_quantity || 1)}x</span>
              </div>
              <div class="row">
                <span>${e(item.quantity_liters)}L x R$ ${Number(item.unit_price).toFixed(2)}</span>
                <span>R$ ${Number(item.total_price).toFixed(2)}</span>
              </div>
            </div>
          `}).join('')}
        </div>
        
        <div class="divider"></div>
        
        ${order.taps ? `<div class="row"><span>Chopeira:</span> <span>${e(order.taps.code)}</span></div>` : ''}
        ${order.cylinders ? `<div class="row"><span>Cilindro:</span> <span>${e(order.cylinders.code)}</span></div>` : ''}
        
        <div class="divider"></div>
        
        <div class="section-title">PAGAMENTOS</div>
        ${payments.length > 0 ? payments.map(p => `
          <div class="row">
            <span>${e(paymentMethodLabels[p.payment_method] || p.payment_method)}</span>
            <span>R$ ${Number(p.amount).toFixed(2)}</span>
          </div>
        `).join('') : '<div class="row"><span>Nenhum pagamento registrado</span></div>'}
        
        <div class="divider"></div>
        
        <div class="row"><span>Subtotal:</span> <span>R$ ${Number(order.subtotal).toFixed(2)}</span></div>
        ${Number(order.discount) > 0 ? `<div class="row"><span>Desconto:</span> <span>- R$ ${Number(order.discount).toFixed(2)}</span></div>` : ''}
        <div class="total">Total: R$ ${Number(order.total).toFixed(2)}</div>
        ${remaining > 0 ? `<div class="row" style="color: red;"><span>Saldo Pendente:</span> <span>R$ ${remaining.toFixed(2)}</span></div>` : ''}
        
        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return { handlePrint };
}
