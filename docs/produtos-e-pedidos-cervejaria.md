# Produtos avulsos e pedidos à cervejaria

## Produtos avulsos

- Cadastre produtos em **Produtos** e ajuste o saldo físico por movimentações.
- Pedidos agendados reservam saldo; a baixa física ocorre ao mudar para `em_andamento`.
- O banco impede baixa repetida e estoque negativo.
- Produtos sem controle de estoque podem ser vendidos sem saldo.
- A edição atual do pedido preserva os produtos adicionais já incluídos; inclusão e remoção desses itens deve ser feita antes da criação ou, futuramente, em uma tela específica de edição.

## Pedidos à cervejaria

- O botão **Enviar** chama a Edge Function `send-brewery-order`.
- Configure os secrets `BREWERY_WEBHOOK_URL` e `BREWERY_WEBHOOK_SECRET` no Supabase.
- Respostas que não sejam HTTP 2xx são tratadas como falha.
- A emissão da nota ou liberação atualiza apenas o status. O estoque da loja só muda na confirmação de recebimento físico.
- O recebimento usa os barris registrados como `na_cervejaria`; não é possível receber mais barris do que o saldo de embalagens na cervejaria.

## Webhook de retorno

Endpoint: `POST /functions/v1/brewery-webhook`

O corpo bruto deve ser assinado com HMAC-SHA256 usando `BREWERY_WEBHOOK_SECRET`. Envie o hexadecimal no cabeçalho `X-Webhook-Signature`, opcionalmente prefixado por `sha256=`.

Campos mínimos:

```json
{
  "event_id": "identificador-unico",
  "event_type": "brewery_order.shipped",
  "order_id": "uuid-do-pedido-no-saas",
  "external_order_id": "pedido-no-sistema-da-cervejaria"
}
```

Eventos aceitos: `accepted`, `confirmed`, `released`, `invoice_issued`, `shipped`, `rejected` e `cancelled`, todos com prefixo `brewery_order.`. Eventos repetidos não são processados novamente. Eventos sem pedido correspondente ficam armazenados com status `unmatched` para conciliação futura.
