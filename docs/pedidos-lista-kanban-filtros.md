# Pedidos: lista, Kanban e filtros

## Decisões

- A página de pedidos possui duas visualizações da mesma coleção: **Lista** e **Kanban**.
- O Kanban usa o status operacional existente como etapa: Agendado, Em andamento, Finalizado e Cancelado.
- Trocar a visualização não altera o status nem grava dados; é somente uma organização visual.
- Os filtros de texto, status do pedido, status do pagamento e atendimento são combinados e valem igualmente para Lista e Kanban.
- O status financeiro é calculado pelo valor do pedido e pela soma dos pagamentos não cancelados:
  - `Pendente`: nenhum valor registrado;
  - `Parcial`: valor registrado menor que o total;
  - `Pago`: valor registrado igual ou maior que o total.
- Pagamentos cancelados não entram no cálculo.
- A consulta principal carrega os pagamentos junto com os pedidos. Isso remove as consultas individuais que antes eram realizadas para cada linha da lista.

## Ações no Kanban

Os cartões mantêm as ações essenciais: detalhes, pagamento, saída de equipamento para pedidos agendados e entrada/devolução para pedidos em andamento. O fluxo de negócio existente é reutilizado; não foram criadas rotinas paralelas.

## Segurança multiempresa

A consulta continua usando o cliente Supabase autenticado e as políticas RLS existentes. Nenhuma tabela, política ou função do banco precisou ser alterada para esta entrega.
