export type DeliveryType = 'entrega' | 'retirada';
export type EquipmentStatus = 'disponivel' | 'em_uso' | 'manutencao';
export type BarrelStatus = 'cheio_loja' | 'com_cliente' | 'vazio_loja' | 'na_cervejaria';
export type CylinderStatus = 'cheio' | 'com_cliente' | 'vazio';
export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'transferencia';
export type PaymentStatus = 'pendente' | 'pago' | 'cancelado';
export type OrderStatus = 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado';

export type PersonType = 'PF' | 'PJ';

export interface Customer {
  id: string;
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  phone: string;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  person_type: PersonType;
  cnpj: string | null;
  company_name: string | null;
  trade_name: string | null;
  state_registration: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface TapType {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Tap {
  id: string;
  code: string;
  tap_type_id: string | null;
  status: EquipmentStatus;
  voltage: '110V' | '220V' | 'Bivolt' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tap_types?: TapType;
}

export interface BeerType {
  id: string;
  name: string;
  description: string | null;
  price_per_liter: number | null;
  cost_per_liter: number | null;
  code: string | null;
  created_at: string;
}

export type NFeStatus = 'emitindo' | 'emitida' | 'erro';

export interface BarrelModel {
  id: string;
  volume: number;
  description: string | null;
  created_at: string;
}

export interface BarrelInventory {
  id: string;
  barrel_model_id: string;
  status: BarrelStatus;
  beer_type_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  barrel_models?: BarrelModel;
  beer_types?: BeerType;
}

export interface Cylinder {
  id: string;
  code: string;
  status: CylinderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string;
  delivery_type: DeliveryType;
  delivery_date: string;
  delivery_time: string | null;
  tap_id: string | null;
  cylinder_id: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes: string | null;
  nfe_number: string | null;
  nfe_issued_at: string | null;
  nfe_status: NFeStatus | null;
  nfe_issued_by: string | null;
  nfe_error_message: string | null;
  nfe_last_attempt_at: string | null;
  nfe_key: string | null;
  delivery_address_street: string | null;
  delivery_address_number: string | null;
  delivery_address_complement: string | null;
  delivery_address_neighborhood: string | null;
  delivery_address_city: string | null;
  delivery_address_state: string | null;
  delivery_address_zip_code: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
  taps?: Tap;
  cylinders?: Cylinder;
}

export interface OrderItem {
  id: string;
  order_id: string;
  barrel_model_id: string | null;
  beer_type_id: string;
  quantity_liters: number;
  unit_price: number;
  total_price: number;
  barrel_quantity: number | null;
  sold_barrel_quantity: number;
  consigned_barrel_quantity: number;
  consigned_consumed_quantity: number | null;
  consigned_returned_quantity: number | null;
  consigned_resolved_at: string | null;
  unit_cost_at_sale: number;
  total_cost_at_sale: number;
  created_at: string;
  beer_types?: BeerType;
  barrel_models?: BarrelModel;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface BeerCostHistory {
  id: string;
  beer_type_id: string;
  cost_per_liter: number;
  valid_from: string;
  valid_to: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  beer_types?: BeerType;
}

export interface CostCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CostEntry {
  id: string;
  category_id: string | null;
  cost_date: string;
  description: string;
  supplier: string | null;
  amount: number;
  notes: string | null;
  is_recurring: boolean;
  created_at: string;
  created_by: string | null;
  cost_categories?: CostCategory;
}
