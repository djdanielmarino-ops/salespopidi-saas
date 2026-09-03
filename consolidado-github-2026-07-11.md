# Consolidado para GitHub - SalesPopidi

Data: 2026-07-11

## Titulo sugerido do commit

```text
fix: ajustar saida, entrada e reserva de chopeiras por periodo
```

## Resumo

Este pacote ajusta regras criticas de operacao do sistema:

- saida de equipamento;
- entrada/devolucao de equipamento;
- reserva de chopeira por periodo de agendamento;
- remanejamento de chopeira/data via edicao de pedido.

O objetivo principal e evitar conflito de agenda e evitar movimentacao fisica de equipamento antes da hora correta.

## Regras implementadas

### Saida do Equipamento

Quando o pedido muda para `em_andamento`:

- barris saem de `cheio_loja`;
- barris entram em `com_cliente`;
- cilindros saem de `cheio`;
- cilindros entram em `com_cliente`;
- chopeira muda para `em_uso`.

### Entrada do Equipamento

Quando o equipamento retorna:

- barris saem de `com_cliente`;
- barris entram em `vazio_loja`;
- cilindros saem de `com_cliente`;
- cilindros entram em `cheio`;
- chopeira muda para `disponivel`;
- pedido muda para `finalizado`;
- `actual_return_date` recebe a data do retorno.

### Agendamento de Chopeira

A chopeira nao pode ser agendada em periodo que conflite com outro pedido ativo.

Pedidos considerados como reserva:

- `agendado`;
- `em_andamento`.

Intervalo considerado:

- inicio: `delivery_date`;
- fim: `expected_return_date`.

Regra de borda:

- se uma chopeira esta reservada de 01 a 07, outro pedido pode iniciar no dia 07;
- outro pedido nao pode iniciar ou cruzar o periodo entre 01 e 06.

### Edicao / Remanejamento

Ao editar um pedido:

- o proprio pedido e ignorado na validacao de conflito;
- isso permite remanejar datas ou trocar chopeira;
- se a chopeira antiga deixar de estar ligada ao pedido, ela fica liberada para aquele periodo;
- se a nova chopeira conflitar com outro pedido, o salvamento e bloqueado.

## Arquivos alterados

```text
src/lib/tapAvailability.ts
src/hooks/useEquipment.ts
src/hooks/useOrders.ts
src/pages/NewOrder.tsx
src/components/orders/OrderEditDialog.tsx
docs/consolidado-github-2026-07-11.md
```

## Validacao realizada

Comandos executados:

```text
npm install
npm run build
```

Resultado:

- build de producao concluido com sucesso.

Avisos vistos:

- dependencias com vulnerabilidades apontadas pelo `npm audit`;
- bundle JavaScript grande;
- Browserslist/caniuse-lite desatualizado.

Esses avisos nao bloqueiam as regras implementadas, mas devem entrar em uma rodada futura de manutencao.

## Atenção antes de subir para GitHub

Nao subir:

```text
node_modules/
dist/
```

Esses caminhos ja aparecem no `.gitignore`.

Padrao definido:

```text
npm
```

Manter:

```text
package-lock.json
```

Foi atualizado/gerado porque usamos `npm install` para validar o build.

Recomendacao:

- usar `npm install`;
- usar `npm run build`;
- subir `package-lock.json`;
- nao usar Bun como padrao deste projeto.

Opcional em uma limpeza futura:

```text
bun.lock
bun.lockb
```

Como o padrao decidido e npm, esses arquivos podem ser removidos em uma rodada futura, se nao forem exigidos pelo Lovable.

## Descricao sugerida para Pull Request

```text
## O que foi feito

- Corrige a movimentacao de status da chopeira para ocorrer apenas na saida real do equipamento.
- Mantem entrada/devolucao retornando barris, cilindros e chopeira aos status corretos.
- Adiciona validacao de reserva de chopeira por periodo usando delivery_date e expected_return_date.
- Bloqueia conflitos de agenda entre pedidos agendados/em andamento.
- Permite remanejamento na edicao do pedido sem o pedido bloquear ele mesmo.
- Impede data prevista de retorno anterior a data de saida.

## Como validar

1. Criar pedido com chopeira A de 01 a 07.
2. Tentar criar outro pedido com a mesma chopeira entre 01 e 06: deve bloquear.
3. Criar outro pedido com a mesma chopeira iniciando em 07: deve permitir.
4. Editar o primeiro pedido e trocar chopeira/data: a reserva anterior deve ser liberada.
5. Confirmar saida: barris/cilindro vao para com_cliente e chopeira vira em_uso.
6. Confirmar entrada: barris vao para vazio_loja, cilindro volta para cheio e chopeira vira disponivel.

## Testes

- npm run build
```
