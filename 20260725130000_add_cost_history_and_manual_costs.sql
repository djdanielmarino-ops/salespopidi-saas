-- Product cost history and manual operating costs.
-- This keeps historical margin reports stable even when chopp costs change later.

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_cost_at_sale NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost_at_sale NUMERIC DEFAULT 0;

UPDATE public.order_items oi
SET
  unit_cost_at_sale = CASE
    WHEN oi.unit_cost_at_sale IS NULL OR oi.unit_cost_at_sale = 0
      THEN COALESCE(bt.cost_per_liter, 0)
    ELSE oi.unit_cost_at_sale
  END,
  total_cost_at_sale = CASE
    WHEN oi.total_cost_at_sale IS NULL OR oi.total_cost_at_sale = 0
      THEN COALESCE(bt.cost_per_liter, 0)
        * CASE
          WHEN COALESCE(oi.barrel_quantity, 0) > 0
            THEN COALESCE(oi.quantity_liters, 0) / oi.barrel_quantity
              * (COALESCE(oi.sold_barrel_quantity, oi.barrel_quantity, 1) + COALESCE(oi.consigned_consumed_quantity, 0))
          ELSE COALESCE(oi.quantity_liters, 0)
        END
    ELSE oi.total_cost_at_sale
  END
FROM public.beer_types bt
WHERE oi.beer_type_id = bt.id;

ALTER TABLE public.order_items
ALTER COLUMN unit_cost_at_sale SET NOT NULL,
ALTER COLUMN total_cost_at_sale SET NOT NULL;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_unit_cost_at_sale_non_negative
CHECK (unit_cost_at_sale >= 0);

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_total_cost_at_sale_non_negative
CHECK (total_cost_at_sale >= 0);

CREATE TABLE IF NOT EXISTS public.beer_cost_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beer_type_id UUID NOT NULL REFERENCES public.beer_types(id) ON DELETE CASCADE,
  cost_per_liter NUMERIC NOT NULL CHECK (cost_per_liter >= 0),
  valid_from DATE NOT NULL,
  valid_to DATE,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_beer_cost_history_beer_dates
ON public.beer_cost_history(beer_type_id, valid_from DESC, valid_to);

CREATE TABLE IF NOT EXISTS public.cost_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.cost_categories(id) ON DELETE SET NULL,
  cost_date DATE NOT NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_cost_entries_cost_date
ON public.cost_entries(cost_date DESC);

INSERT INTO public.cost_categories (name, description)
VALUES
  ('Chopp', 'Custos de compra ou producao de chopp'),
  ('Energia eletrica', 'Conta de luz e energia'),
  ('Agua', 'Conta de agua'),
  ('DAS / impostos', 'Impostos, DAS e tributos'),
  ('Contador', 'Honorarios contabeis'),
  ('Combustivel', 'Combustivel e deslocamentos'),
  ('Manutencao', 'Manutencao de equipamentos'),
  ('Marketing', 'Divulgacao, trafego e materiais'),
  ('Outros', 'Custos diversos')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.beer_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view beer cost history"
ON public.beer_cost_history FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage beer cost history"
ON public.beer_cost_history FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view cost categories"
ON public.cost_categories FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage cost categories"
ON public.cost_categories FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view cost entries"
ON public.cost_entries FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage cost entries"
ON public.cost_entries FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
