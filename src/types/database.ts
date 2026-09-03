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
  supplier?: string | null;
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
  created_at: string;
  beer_types?: BeerType;
  barrel_models?: BarrelModel;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  sale_price: number;
  current_cost: number;
  stock_quantity: number;
  minimum_stock: number;
  track_stock: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderProductItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  stock_moved_at: string | null;
  created_at: string;
  products?: Product;
}

export interface ProductInventoryMovement {
  id: string;
  product_id: string;
  order_id: string | null;
  movement_type: 'initial' | 'entry' | 'sale' | 'sale_reversal' | 'adjustment';
  quantity: number;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  created_at: string;
}

export type BreweryOrderStatus = 'draft' | 'pending_send' | 'sent' | 'acknowledged' | 'confirmed' | 'released' | 'in_transit' | 'partially_received' | 'received' | 'rejected' | 'cancelled' | 'discrepancy';
export interface BreweryOrderItem { id: string; brewery_order_id: string; barrel_model_id: string; beer_type_id: string; quantity_ordered: number; quantity_released: number; quantity_received: number; unit_cost: number | null; notes: string | null; beer_types?: BeerType; barrel_models?: BarrelModel; }
export interface BreweryOrder { id: string; order_number: number; supplier: string; status: BreweryOrderStatus; external_order_id: string | null; expected_delivery_date: string | null; invoice_number: string | null; invoice_key: string | null; invoice_issued_at: string | null; notes: string | null; sent_at: string | null; received_at: string | null; created_at: string; updated_at: string; brewery_order_items?: BreweryOrderItem[]; }

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  payment_method_config_id?: string | null;
  account_id?: string | null;
  fee_percentage_snapshot?: number;
  fee_fixed_snapshot?: number;
  fee_payer_snapshot?: FeePayer | null;
  calculated_fee?: number;
  deducted_fee?: number;
  net_amount?: number | null;
  expected_at?: string | null;
  settled_at?: string | null;
}

export type FinancialAccountType = 'cash' | 'checking' | 'digital_wallet' | 'other';
export type FeePayer = 'company' | 'customer';
export type FinancialTransactionStatus = 'expected' | 'confirmed' | 'cancelled';

export interface FinancialAccount {
  id: string;
  name: string;
  account_type: FinancialAccountType;
  bank_name: string | null;
  opening_balance: number;
  opening_balance_date: string;
  color: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  base_method: PaymentMethod;
  default_account_id: string;
  fee_percentage: number;
  fee_fixed: number;
  fee_payer: FeePayer;
  settlement_days: number;
  is_active: boolean;
  financial_accounts?: FinancialAccount;
}

export interface FinancialTransaction {
  id: string;
  account_id: string;
  transaction_type: 'opening_balance' | 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'adjustment';
  status: FinancialTransactionStatus;
  description: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  effective_date: string;
  occurred_at: string;
  payment_id: string | null;
  cost_entry_id: string | null;
  transfer_group_id: string | null;
  metadata: Record<string, unknown>;
  financial_accounts?: FinancialAccount;
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
  cost_categories?: CostCategory | null;
  payment_status?: 'pending' | 'paid';
  due_date?: string | null;
  paid_date?: string | null;
  account_id?: string | null;
  payment_method_config_id?: string | null;
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
