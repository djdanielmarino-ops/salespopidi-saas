# Arquitetura SaaS

## Objetivo

Manter uma unica aplicacao e uma unica linha de atualizacao para quatro formatos de operacao:

1. loja ou PDV;
2. distribuidora;
3. cervejaria;
4. rede integrada entre cervejaria, distribuidores e lojas.

Cada cliente da plataforma e uma organizacao. Uma organizacao pode possuir varias unidades e habilitar um ou mais modulos sem receber uma copia separada do codigo.

## Modelo de dominio

### Controle da plataforma

- `organizations`: cliente titular do SaaS;
- `organization_units`: lojas, fabricas, centros de distribuicao e escritorios;
- `organization_members`: vinculo entre usuario, organizacao e papel;
- `plans` e `subscriptions`: plano, vigencia, situacao e limites;
- `organization_modules`: funcionalidades liberadas por organizacao;
- `platform_admins`: equipe autorizada a operar o painel global;
- `audit_logs`: trilha imutavel de acoes sensiveis;
- `support_access_grants`: acesso temporario e auditado para suporte.

### Operacao

As tabelas de clientes, pedidos, pagamentos, estoque, produtos, custos, contas financeiras, equipamentos e movimentos pertencem a uma organizacao. Quando aplicavel, tambem pertencem a uma unidade.

O identificador da organizacao deve ser propagado nos registros filhos, mesmo quando puder ser deduzido por uma chave estrangeira. Isso simplifica e torna mais eficiente a aplicacao de RLS, indices e auditoria. Triggers de consistencia devem impedir relacionamentos entre registros de organizacoes diferentes.

### Rede comercial

Uma loja e uma cervejaria continuam sendo organizacoes independentes. A conexao comercial nao concede acesso irrestrito aos bancos uma da outra.

- `organization_relationships` representa uma relacao aprovada entre fornecedor e comprador;
- catalogos, tabelas de preco e condicoes comerciais podem ser compartilhados explicitamente;
- um pedido B2B gera referencias correlacionadas em ambos os lados;
- eventos de integracao sincronizam aceite, separacao, faturamento, expedicao e recebimento;
- cada lado mantem seus dados internos, usuarios, financeiro e estoque isolados.

## Autorizacao

Existem duas camadas diferentes:

1. administracao da plataforma, exclusiva da operadora do SaaS;
2. administracao da organizacao, exclusiva dos proprietarios e administradores daquele cliente.

Os papeis iniciais sao:

- `platform_owner` e `platform_support`;
- `organization_owner` e `organization_admin`;
- `manager`, `operator`, `sales`, `finance` e `viewer`.

Permissoes efetivas combinam papel, modulos contratados, situacao da assinatura e escopo de unidade. Dados de autorizacao nao devem ser derivados de `user_metadata`, pois esse campo pode ser alterado pelo proprio usuario.

## Isolamento e bloqueio

Todas as tabelas expostas usam RLS. Uma operacao so e permitida quando:

- o usuario e membro ativo da organizacao do registro;
- a organizacao esta ativa para a operacao solicitada;
- o modulo correspondente esta habilitado;
- o papel possui a permissao necessaria;
- a unidade esta dentro do escopo do usuario, quando houver restricao por unidade.

Suspensao comercial deve preservar leitura e exportacao durante um periodo configuravel, mas bloquear novas operacoes. Bloqueio de seguranca pode interromper leitura e escrita imediatamente. Essas situacoes nao devem ser tratadas como um unico booleano.

## Integracoes

`integration_connections` representa conexoes por organizacao e por ambiente. Exemplos: WhatsApp, n8n, NFe, pagamento, ERP e e-mail.

`webhook_endpoints` armazena inscricoes de saida. `integration_events` e `webhook_deliveries` registram eventos, tentativas e respostas. O fluxo deve oferecer:

- assinatura HMAC;
- idempotencia;
- timeout;
- repeticao com backoff;
- fila de mensagens mortas;
- reenvio manual;
- mascaramento de dados sensiveis;
- logs por organizacao;
- URLs distintas para teste e producao.

Segredos nunca ficam no frontend nem em colunas retornadas pela Data API. O armazenamento e a leitura acontecem somente no backend, com uma referencia publica separada do valor secreto.

## Aplicacao

O frontend continua sendo uma aplicacao React unica. Depois do login, o usuario escolhe a organizacao ativa quando possuir mais de uma. Toda chave de cache e toda chamada que dependa de contexto deve considerar a organizacao ativa.

O menu e as rotas usam capacidades da organizacao, mas isso e apenas experiencia de usuario. A decisao de autorizacao definitiva permanece no banco e nas funcoes de backend.

## Deploy

- branches e pull requests geram previews na Vercel;
- a branch de producao publica a mesma versao para todos os clientes;
- mudancas de banco sao versionadas em migracoes;
- liberacoes graduais usam modulos e feature flags por organizacao;
- producao, homologacao e desenvolvimento usam projetos e segredos separados.
