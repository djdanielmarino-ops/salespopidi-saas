# Controle patrimonial de barris

## Decisão

O estoque operacional e o patrimônio são conceitos diferentes:

- `barrel_inventory` informa onde os barris estão e em que condição;
- `barrel_patrimony_targets` informa quantos barris pertencem à organização por litragem;
- a diferença entre a soma operacional e o patrimônio gera o indicador conferido, faltando ou sobrando;
- `barrel_inventory_adjustments` é um livro imutável dos ajustes manuais.

Essa separação permite representar, por exemplo, 49 barris de 50 L e 76 barris de 30 L, mesmo que estejam distribuídos entre loja, clientes e cervejaria.

## Ajuste de contagem

Um ajuste não sobrescreve silenciosamente o estoque. O usuário informa a quantidade final contada, um motivo padronizado e uma justificativa. O backend registra:

- quantidade anterior;
- quantidade final;
- diferença calculada;
- modelo, status e tipo de chopp afetados;
- usuário responsável;
- data e hora;
- justificativa e categoria do ajuste.

Os motivos iniciais são contagem física, devolução parcial, erro de lançamento, avaria ou perda, aquisição, baixa patrimonial e outro.

## Autorização

Podem ajustar contagens e patrimônio:

- `platform_owner` ativo;
- `organization_owner` ativo;
- `organization_admin` ativo;
- membro ativo com `permissions.barrel_adjustments = "manage"`.

A permissão aparece em **Configurações > Funcionários e acessos** como **Ajustes sensíveis de barris**. A interface oculta ações e histórico sem essa permissão, mas a decisão final também é repetida no backend antes da transação. A chave `service_role` permanece somente na Edge Function `barrel-inventory-control`.

As RPCs de gravação são `SECURITY INVOKER`, executáveis somente por `service_role`, bloqueando chamadas diretas de usuários autenticados. Cada alteração também gera uma entrada em `audit_logs`.

## Compras e fornecedores

O módulo antes chamado `brewery_orders` passa a usar a chave comercial `purchases` e o nome **Compras / Fornecedores**. As tabelas e a rota antigas são mantidas neste momento para compatibilidade. Permissões existentes são migradas a partir de `barrels`, evitando perda de acesso durante a transição.

## Contagem inicial e ajustes

O comando **Nova contagem / ajuste** permite criar a primeira linha de estoque mesmo quando o detalhamento está vazio. O operador autorizado escolhe volume, localização, tipo de chopp quando aplicável, quantidade contada, motivo e justificativa.

Se a combinação de volume, localização e tipo de chopp já existir, o sistema atualiza a contagem existente em vez de duplicá-la. A alteração fica registrada no histórico e em `audit_logs`.

Na primeira versão, “localização” representa o estado operacional agregado: cheio na loja, com cliente, vazio na loja ou na cervejaria. O rastreamento de cada barril por número patrimonial individual é uma evolução separada.

## Limites e evolução

Este incremento controla quantidades agregadas por litragem. Identificação individual com número patrimonial, QR Code ou RFID deve ser uma etapa posterior para organizações que precisem rastrear cada casco. Também é necessário centralizar progressivamente todas as movimentações operacionais de barris no backend; enquanto fluxos antigos ainda escrevem diretamente em `barrel_inventory`, RLS e auditoria continuam sendo a proteção complementar.

## Verificação da entrega

- migration `20260903184308_barrel_inventory_control.sql` aplicada no projeto SaaS;
- Edge Functions `barrel-inventory-control`, `organization-users` e `master-organizations` publicadas;
- build de produção e lint dos arquivos alterados aprovados;
- advisor de desempenho sem alertas;
- advisor de segurança manteve um alerta de configuração: proteção contra senhas vazadas desabilitada no Supabase Auth;
- 7 testes automatizados passaram; 2 suítes preexistentes não iniciam sem as variáveis Supabase no ambiente de teste.
