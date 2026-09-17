# Histórico de vendas e despesas

O histórico legado usa `historical_transactions`, separado de `orders` e das tabelas operacionais. Sua carga não gera estoque, recebíveis, notas fiscais, mensagens ou saldos de caixa atuais.

## Semântica confirmada pelo proprietário

- `VALOR`: preço previsto, salvo em `quoted_amount`.
- `PAGO`: valor recebido, salvo em `paid_amount`; é a base da análise de recebimentos.
- `FALTA`: informação histórica, sem criar cobrança atual.
- `QUANTIDADE`: litros nas bebidas. Serviços, despesas e aquecedores não entram em `beverage_liters`.
- `LUCRO`: resultado informado sobre o recebido menos custos registrados. Não representa lucro líquido contábil: despesas podem estar incompletas.
- A0013: despesas, sem vínculo com um cliente de vendas.
- Aquecedores: preservados na fonte como `unclassified`, excluídos das análises de vendas, conforme orientação do proprietário.

## Rastreabilidade e correspondência

Cada linha mantém JSON original, linha da fonte, lote e SHA-256 da cópia JSON congelada do CSV. A unicidade por empresa, hash e linha impede repetir a mesma carga. O hash identifica a cópia analisada, não os bytes do CSV original.

`customer_legacy_ids` liga IDs antigos aos UUIDs do cadastro atual. IDs das linhas de clientes consolidadas por duplicidade apontam para o primeiro cadastro preservado. IDs são comparados sem distinção entre maiúsculas e minúsculas. Códigos desconhecidos e vendas sem ID permanecem sem vínculo; não se presume que nomes parecidos são a mesma pessoa.

Valores ausentes ou erros de planilha, como `#N/A`, permanecem nulos nos campos numéricos. `R$ -` é o zero no formato contábil da fonte. Os valores originais ficam intactos no JSON. As linhas de dados são registros da fonte, não necessariamente pedidos únicos.

Repetições exatas são sinalizadas em `duplicate_of_row`, sem exclusão automática, pois não há identificador único de transação. Os resumos incluem essas linhas e expõem sua contagem; precisam ser revisadas antes de uso contábil definitivo.

## Consultas disponíveis

- `historical_sales_monthly`: registros de venda/despesa, valores previstos e recebidos, custos registrados e pendências por mês.
- `historical_products_monthly`: recebimentos e litros por produto/mês.
- `historical_customer_activity`: primeira/última venda, número de registros e recebimentos por cliente vinculado.

As views usam `security_invoker`, respeitam RLS e consideram somente lotes concluídos. As tabelas permitem leitura por membros da empresa e escrita apenas pelo backend; o acesso às views depende também da permissão existente de leitura dos lotes. Nenhuma informação deve atravessar empresas.

## Aplicações recomendadas

1. CRM: identificar clientes recorrentes e sem novas compras, sempre apresentando a data de referência e a cobertura dos IDs.
2. Produtos: comparar litros, preço recebido por litro e participação ao longo do tempo, mantendo serviços fora do denominador de litros.
3. Planejamento: sazonalidade mensal e comparação entre períodos equivalentes; 2012 e 2026 estão incompletos.
4. Qualidade: revisar IDs desconhecidos, recebimentos ausentes e repetições antes de consolidar indicadores financeiros.

As views preparam os dados para relatórios; as telas financeiras existentes continuam usando operações nativas até uma integração explícita. Não somar automaticamente histórico e operações atuais sem verificar sobreposição por data e origem.
