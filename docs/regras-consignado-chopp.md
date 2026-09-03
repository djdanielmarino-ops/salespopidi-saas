# Regras do consignado de chopp

Data: 2026-07-25

## Objetivo

Permitir enviar barris de chopp em consignacao junto de um pedido, sem cobrar no total inicial, mas retirando fisicamente do estoque ate a devolucao.

## Modelo adotado

Cada item de chopp possui:

- quantidade comprada;
- quantidade consignada;
- preco por litro;
- volume do barril.

O total inicial do pedido considera apenas a quantidade comprada.

O consignado aparece como valor pendente potencial, mas nao entra no total ate a entrada/devolucao.

## Saida do equipamento

Ao confirmar a saida:

- barris comprados saem de `cheio_loja` e entram em `com_cliente`;
- barris consignados tambem saem de `cheio_loja` e entram em `com_cliente`;
- a chopeira muda para `em_uso`;
- o pedido muda para `em_andamento`.

## Entrada do equipamento

Ao confirmar a entrada, se houver consignado pendente, o sistema pergunta quantos barris consignados foram consumidos.

Para os barris consignados consumidos:

- entram na cobranca do pedido;
- retornam ao estoque como `vazio_loja`.

Para os barris consignados nao consumidos:

- nao entram na cobranca;
- retornam ao estoque como `cheio_loja`.

O pedido so finaliza depois dessa decisao.

## Campos novos no banco

Tabela: `public.order_items`

- `sold_barrel_quantity`
- `consigned_barrel_quantity`
- `consigned_consumed_quantity`
- `consigned_returned_quantity`
- `consigned_resolved_at`

Pedidos antigos sao tratados como compra normal:

- `sold_barrel_quantity = barrel_quantity`;
- `consigned_barrel_quantity = 0`.

## Arquivos principais

- `supabase/migrations/20260725110000_add_consigned_order_items.sql`
- `src/pages/NewOrder.tsx`
- `src/components/orders/OrderEditDialog.tsx`
- `src/pages/Orders.tsx`
- `src/hooks/useOrders.ts`
- `src/hooks/useBarrelInventory.ts`
- `src/hooks/useEquipment.ts`
- `src/lib/tapAvailability.ts`
- `src/types/database.ts`
- `src/integrations/supabase/types.ts`

## Validacao

Executado:

```text
npm install
npm run build
```

Resultado:

- build concluido com sucesso.

Avisos restantes:

- vulnerabilidades indicadas pelo `npm audit`;
- bundle JavaScript grande;
- Browserslist/caniuse-lite desatualizado.

Esses avisos nao bloqueiam a funcionalidade.

