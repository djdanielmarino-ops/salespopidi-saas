# Contratos de webhooks do Sales Popidi

Versão inicial: 1

## Envelope comum

Todo evento deve carregar event_id, event_type, schema_version, organization_id,
unit_id quando aplicável, occurred_at e data.

O event_id é a chave de idempotência. O receptor deve responder HTTP 2xx somente
depois de aceitar o evento e deve ignorar, com sucesso, repetições do mesmo ID.

## 1. Controle de barris

- Chave: barrels_daily_summary
- Direção: Sales Popidi para n8n
- Evento inicial: barrel.inventory.updated
- Dados: posição por volume, localização, tipo de chopp, entradas, saídas e saldo.

## 2. Automação de mensagens

- Chave: orders_automation
- Direção: Sales Popidi para n8n
- Eventos: order.dispatched e order.completed
- Dados: pedido, cliente, telefone, entrega, equipamentos e situação.

## 3. Emissão de NFe

- Chave: nfe_issue
- Direção: Sales Popidi para n8n
- Evento: invoice.requested
- Dados: cliente, endereço fiscal, itens, pagamentos, totais e pedido.
- Retorno: `POST /functions/v1/update-nfe`, usando `x-api-key` e
  `organization_id`. Para compatibilidade, aceita `status` ou `nfe_status`.

## 4. Pedidos diários

- Chave: daily_orders
- Direção: Sales Popidi para n8n
- Evento: orders.daily_summary
- Dados: data, fuso horário, quantidade e lista resumida de pedidos.
- O modelo futuro será envio agendado. A consulta antiga do n8n permanecerá
  temporariamente para compatibilidade.

## 5. Compras / Fornecedor

- Chave: brewery_orders_send
- Direção: Sales Popidi para n8n
- Evento: brewery_order.created
- Dados: fornecedor, itens, volumes, chopes, quantidades, custos e previsão.

## 6. Recebimento de pedido

- Chave: brewery_order_receive
- Direção: n8n para Sales Popidi
- Eventos: brewery_order.accepted, brewery_order.confirmed,
  brewery_order.invoice_issued, brewery_order.shipped,
  brewery_order.rejected e brewery_order.cancelled.
- A atualização eletrônica não dá entrada física no estoque.
- A loja confere o recebimento e registra falta, sobra ou divergência.
- Endpoint: `POST /functions/v1/brewery-webhook`.
- Autenticação: chave individual da empresa no header `x-api-key`.
- Campos obrigatórios: `organization_id`, `event_id` e `event_type`.

## 7. Formulário

- Chave: order_form_receive
- Direção: n8n para Sales Popidi
- Evento: order.form_submitted
- Dados: empresa de destino, identificador externo, cliente, consentimento,
  endereço, itens, entrega, cobrança e observações.
- Endpoint: `POST /functions/v1/submit-order`.
- Autenticação: chave individual da empresa no header `x-api-key`.
- Campos obrigatórios: `organization_id`, `personal.nome` e
  `personal.whatsapp`.

## Configuração das entradas

O Master gera uma chave diferente para cada empresa. O valor aparece somente
uma vez; no banco é armazenado apenas o hash SHA-256. Ao rotacionar a chave, a
anterior deixa de funcionar imediatamente.

No n8n, configurar:

- Método: POST.
- Header: `x-api-key: <chave gerada no Master>`.
- Corpo JSON: sempre incluir `organization_id` da empresa selecionada.

## Segurança

- Entradas validam a organização e uma chave individual por empresa.
- A chave aparece no navegador apenas no momento da geração e somente seu hash
  SHA-256 é persistido.
- Eventos da cervejaria usam `event_id` para idempotência.
- Eventos e tentativas serão registrados nas tabelas de integração.
- Dados sensíveis deverão ser mascarados nos logs.

## Respostas

- 200 ou 202: aceito ou processado;
- 400: payload inválido;
- 401: assinatura inválida;
- 404: organização ou recurso não encontrado;
- 409: evento já processado ou conflito de estado;
- 422: evento válido, mas incompatível com a situação atual;
- 500: falha interna passível de nova tentativa.
