# Custos e Historico de Produtos

## Objetivo

Controlar custos operacionais e custo historico do chopp sem perder a margem real de pedidos antigos.

## Regras Implementadas

1. Cada pedido novo salva uma foto do custo do chopp no item:
   - `order_items.unit_cost_at_sale`: custo por litro usado naquela venda.
   - `order_items.total_cost_at_sale`: custo total reconhecido naquele item.

2. O custo do item e calculado pela data de entrega do pedido:
   - primeiro busca um registro valido em `beer_cost_history`;
   - se nao encontrar, usa `beer_types.cost_per_liter`;
   - se nao houver custo cadastrado, usa `0`.

3. Alterar o custo atual do chopp nao altera pedidos antigos.

4. Consignado:
   - na criacao do pedido, o custo considera apenas os barris vendidos;
   - se o consignado for consumido na devolucao, o custo do item passa a incluir os barris consumidos;
   - se o consignado retornar cheio, ele nao entra no custo vendido.

5. Custos manuais ficam em `cost_entries`:
   - agua, luz, DAS, contador, combustivel, manutencao e outros;
   - categorias ficam em `cost_categories`;
   - o painel financeiro soma custo de produto + custos manuais no periodo.

## Como Usar

1. Abra a aba `Custos`.
2. Em `Historico do Chopp`, registre o custo por litro, tipo de chopp e data de inicio.
3. Em `Custos Manuais`, registre despesas operacionais com data, categoria e valor.
4. O financeiro passa a usar esses dados para calcular lucro com mais fidelidade.

## Cuidados de Seguranca e Dados

- Nao editar pedidos antigos apenas para atualizar custo atual.
- Para corrigir margem antiga, preferir ajustar `unit_cost_at_sale` e `total_cost_at_sale` de forma controlada por SQL revisado.
- Antes de importar historico externo, padronizar nomes de clientes, telefones e documentos para evitar duplicidade.
- Manter backups/exportacoes antes de migrations ou importacoes em massa.

## Proximos Passos

- Criar importacao de pedidos historicos.
- Criar rotina de vinculacao de clientes entre bases com regras de confianca.
- Evoluir dashboard com receita, lucro, litros vendidos, clientes e meios de pagamento.
