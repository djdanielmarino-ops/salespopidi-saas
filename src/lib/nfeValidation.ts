import { Order, Customer, OrderItem } from '@/types/database';

export interface NFeValidationResult {
  valid: boolean;
  missing: string[];
}

export function validateOrderForNFe(
  order: Order,
  customer: Customer | null | undefined,
  items: OrderItem[] | null | undefined,
  totalPaid: number,
): NFeValidationResult {
  const missing: string[] = [];

  // Elegibilidade: depende apenas do financeiro (pedido pago e não cancelado).
  // Independe de devolução de equipamento ou status logístico.
  if (order.status === 'cancelado') missing.push('Pedido está cancelado');
  if (!(Number(order.total) > 0) || totalPaid < Number(order.total)) missing.push('Pagamento não está quitado');
  if (order.nfe_status === 'emitida') missing.push('NFe já foi emitida');
  if (order.nfe_status === 'emitindo') missing.push('NFe já está em processamento');

  // Customer
  if (!customer) {
    missing.push('Cliente');
    return { valid: false, missing };
  }

  if (customer.person_type === 'PJ') {
    if (!customer.cnpj) missing.push('CNPJ');
    if (!customer.company_name) missing.push('Razão social');
  } else {
    if (!customer.cpf) missing.push('CPF');
    if (!customer.full_name) missing.push('Nome completo');
  }

  // Address (delivery vs customer)
  const useDelivery = order.delivery_type === 'entrega';
  const addr = useDelivery
    ? {
        street: order.delivery_address_street,
        number: order.delivery_address_number,
        neighborhood: order.delivery_address_neighborhood,
        city: order.delivery_address_city,
        state: order.delivery_address_state,
        zip: order.delivery_address_zip_code,
      }
    : {
        street: customer.street,
        number: customer.number,
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        zip: customer.zip_code,
      };

  const prefix = useDelivery ? 'Endereço de entrega' : 'Endereço do cliente';
  if (!addr.street) missing.push(`${prefix}: logradouro`);
  if (!addr.number) missing.push(`${prefix}: número`);
  if (!addr.neighborhood) missing.push(`${prefix}: bairro`);
  if (!addr.city) missing.push(`${prefix}: cidade`);
  if (!addr.state) missing.push(`${prefix}: UF`);
  if (!addr.zip) missing.push(`${prefix}: CEP`);

  // Items must have product code
  if (!items || items.length === 0) {
    missing.push('Itens do pedido');
  } else {
    for (const it of items) {
      if (!it.beer_types?.code) {
        missing.push(`Código do produto: ${it.beer_types?.name || 'desconhecido'}`);
      }
    }
  }

  return { valid: missing.length === 0, missing };
}
