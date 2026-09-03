import { Order, OrderItem } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { escapeHtml as e } from '@/lib/escapeHtml';

interface PrintContractProps {
  order: Order;
  items: OrderItem[];
}

export function PrintContract({ order, items }: PrintContractProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const deliveryAddress = order.delivery_type === 'entrega' && order.delivery_address_street
      ? `${e(order.delivery_address_street)}, ${e(order.delivery_address_number || 'S/N')}${order.delivery_address_complement ? ` - ${e(order.delivery_address_complement)}` : ''}, ${e(order.delivery_address_neighborhood || '')} - ${e(order.delivery_address_city || '')}/${e(order.delivery_address_state || '')} - CEP: ${e(order.delivery_address_zip_code || '')}`
      : order.customers?.street
        ? `${e(order.customers.street)}, ${e(order.customers.number || 'S/N')}${order.customers.complement ? ` - ${e(order.customers.complement)}` : ''}, ${e(order.customers.neighborhood || '')} - ${e(order.customers.city || '')}/${e(order.customers.state || '')} - CEP: ${e(order.customers.zip_code || '')}`
        : 'Não informado';

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contrato de Locação - Pedido #${e(order.order_number)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 30px; text-transform: uppercase; }
          .section { margin: 20px 0; }
          .section-title { font-weight: bold; margin-bottom: 10px; text-transform: uppercase; font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .field { margin: 5px 0; font-size: 12px; }
          .field strong { display: inline-block; width: 150px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          .signature { margin-top: 60px; display: flex; justify-content: space-between; }
          .signature-box { width: 45%; text-align: center; }
          .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 10px; font-size: 11px; }
          .terms { font-size: 10px; margin-top: 30px; }
          .terms h3 { font-size: 11px; margin-bottom: 10px; }
          .terms ol { padding-left: 20px; }
          .terms li { margin-bottom: 5px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Contrato de Locação de Equipamentos para Chopp</h1>
        
        <div class="section">
          <div class="section-title">Dados do Contrato</div>
          <div class="field"><strong>Nº do Pedido:</strong> #${e(order.order_number)}</div>
          <div class="field"><strong>Data de Saída:</strong> ${format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}${order.delivery_time ? ` às ${e(order.delivery_time.slice(0, 5))}` : ''}</div>
          <div class="field"><strong>Data de Retorno:</strong> ${order.expected_return_date ? format(parseISO(order.expected_return_date), 'dd/MM/yyyy', { locale: ptBR }) : 'A combinar'}</div>
          <div class="field"><strong>Tipo:</strong> ${order.delivery_type === 'entrega' ? 'Entrega' : 'Retirada na Loja'}</div>
        </div>
        
        <div class="section">
          <div class="section-title">Dados do Locatário</div>
          <div class="field"><strong>Nome:</strong> ${e(order.customers?.full_name)}</div>
          <div class="field"><strong>CPF:</strong> ${e(order.customers?.cpf || 'Não informado')}</div>
          <div class="field"><strong>RG:</strong> ${e(order.customers?.rg || 'Não informado')}</div>
          <div class="field"><strong>Telefone:</strong> ${e(order.customers?.phone)}</div>
          <div class="field"><strong>E-mail:</strong> ${e(order.customers?.email || 'Não informado')}</div>
          <div class="field"><strong>Endereço:</strong> ${deliveryAddress}</div>
        </div>
        
        <div class="section">
          <div class="section-title">Equipamentos Locados</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              ${order.taps ? `<tr><td>Chopeira</td><td>${e(order.taps.code)}</td><td>${e(order.taps.tap_types?.name || '-')}${order.taps.voltage ? ` - ${e(order.taps.voltage)}` : ''}</td></tr>` : ''}
              ${order.cylinders ? `<tr><td>Cilindro de Gás</td><td>${e(order.cylinders.code)}</td><td>-</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">Produtos</div>
          <table>
            <thead>
              <tr>
                <th>Chopp</th>
                <th>Volume</th>
                <th>Qtd</th>
                <th>Preço/L</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const volume = item.barrel_models?.volume || Math.round(item.quantity_liters / (item.barrel_quantity || 1));
                return `
                <tr>
                  <td>${e(item.beer_types?.name)}</td>
                  <td>${e(volume)}L</td>
                  <td>${e(item.barrel_quantity || 1)}</td>
                  <td>R$ ${Number(item.unit_price).toFixed(2)}</td>
                  <td>R$ ${Number(item.total_price).toFixed(2)}</td>
                </tr>
              `}).join('')}
              <tr style="font-weight: bold;">
                <td colspan="4">TOTAL</td>
                <td>R$ ${Number(order.total).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="terms">
          <h3>TERMOS E CONDIÇÕES</h3>
          <ol>
            <li>O LOCATÁRIO se compromete a devolver os equipamentos em perfeito estado de conservação.</li>
            <li>Danos causados aos equipamentos durante o período de locação serão de responsabilidade do LOCATÁRIO.</li>
            <li>O LOCATÁRIO autoriza a cobrança de taxas adicionais em caso de atraso na devolução.</li>
            <li>Os equipamentos devem ser utilizados apenas para os fins destinados.</li>
            <li>É proibida a sublocação dos equipamentos sem autorização prévia.</li>
            <li>O LOCATÁRIO declara ter recebido os equipamentos em perfeitas condições de funcionamento.</li>
          </ol>
        </div>
        
        <div class="signature">
          <div class="signature-box">
            <div class="signature-line">
              LOCADOR<br/>
              ChoppControl
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              LOCATÁRIO<br/>
              ${e(order.customers?.full_name)}<br/>
              CPF: ${e(order.customers?.cpf || '_______________')}
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #666;">
          Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
