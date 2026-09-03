# Plano de migracao multiempresa

## Estado atual observado

O sistema ja possui dominios relevantes de loja e cervejaria, incluindo pedidos, clientes, produtos, barris, cilindros, equipamentos, custos, financeiro, NFe e funcoes de integracao.

Entretanto, as tabelas operacionais nao possuem `organization_id`. Parte das politicas historicas usa `USING (true)` e outra parte concede acesso a qualquer usuario autenticado com determinada permissao global. Isso autentica o usuario, mas nao isola os dados de clientes diferentes.

Tambem foram encontrados endpoints de n8n/NFe definidos diretamente em funcoes. Eles devem ser substituidos por conexoes resolvidas no contexto da organizacao.

## Estrategia sem interrupcao

A migracao sera aditiva e dividida em etapas. Nenhuma coluna obrigatoria ou politica atual deve ser substituida antes do preenchimento e da validacao dos dados existentes.

### Etapa 1 — Estrutura de controle

Criar as tabelas de organizacoes, unidades, membros, modulos, assinaturas e auditoria. Cadastrar a Popidi como organizacao inicial e vincular os usuarios atuais.

Criterio de aceite: cada usuario atual possui um vinculo valido e a aplicacao continua funcionando sem alteracao visual.

### Etapa 2 — Identidade de organizacao nos dados

Adicionar `organization_id` inicialmente anulavel a todas as tabelas operacionais. Preencher os registros existentes com a organizacao Popidi. Adicionar indices e validar chaves estrangeiras.

Principais grupos:

- comercial: `customers`, `orders`, `order_items`, `payments` e itens de produtos;
- catalogo/estoque: produtos, tipos de chopp, modelos e inventarios;
- ativos: chopeiras, barris, cilindros e movimentos;
- financeiro: contas, configuracoes de pagamento, lancamentos e custos;
- cervejaria: pedidos, itens, movimentos e eventos de integracao;
- usuarios: substituir o perfil global por associacoes por organizacao.

Criterio de aceite: nenhum registro operacional fica sem organizacao e nenhuma relacao cruza organizacoes.

### Etapa 3 — RLS multiempresa

Criar funcoes auxiliares pequenas para consultar associacao, papel e permissao. Aplicar politicas separadas para SELECT, INSERT, UPDATE e DELETE. Remover politicas permissivas somente depois de testes de permitir e negar.

Os testes devem cobrir:

- membro A le e altera apenas dados da organizacao A;
- membro B nao consegue ler nem referenciar dados da organizacao A;
- usuario suspenso nao cria operacoes;
- administrador de uma organizacao nao administra outra;
- administrador da plataforma usa somente rotas administrativas autorizadas;
- service role permanece restrita a funcoes de backend;
- INSERT e UPDATE nao permitem trocar `organization_id`.

### Etapa 4 — Contexto no frontend

Adicionar carregamento de organizacoes do usuario, seletor de organizacao e provider de contexto. Incluir o identificador da organizacao nas chaves do React Query e limpar caches ao trocar de empresa.

Todas as insercoes devem obter o contexto de maneira confiavel. A preferencia e o backend derivar a organizacao a partir de uma associacao valida, sem confiar isoladamente em um valor enviado pelo navegador.

### Etapa 5 — Painel da plataforma

Implementar cadastro, ativacao, suspensao, modulos, usuarios, planos, cobrancas, integracoes, suporte e auditoria. O painel global nao deve reutilizar o papel `admin` atual das lojas.

### Etapa 6 — Integracoes por organizacao

Migrar WhatsApp, n8n, NFe e cervejaria para `integration_connections`. Remover URLs globais do codigo depois que todas as conexoes da Popidi estiverem cadastradas e testadas.

### Etapa 7 — Rede cervejaria–PDV

Adicionar relacionamentos comerciais e o ciclo B2B. A sincronizacao deve ocorrer por eventos idempotentes, sem conceder acesso direto de uma organizacao ao restante dos dados da outra.

## Ordem tecnica das primeiras entregas

1. congelar e documentar o estado do schema de producao;
2. criar ambiente de homologacao e backup verificavel;
3. criar a migracao aditiva da Etapa 1;
4. gerar testes de RLS;
5. executar a migracao e os testes em homologacao;
6. introduzir o contexto de organizacao no frontend;
7. migrar um dominio por vez, comecando por clientes e pedidos;
8. executar testes de regressao do fluxo atual;
9. migrar os demais dominios;
10. liberar uma segunda organizacao piloto somente apos o teste de isolamento.

## Condicoes antes de aplicar em producao

- acesso ao projeto Supabase e ao schema remoto confirmado;
- backup recente com restauracao testada;
- ambiente de homologacao separado;
- usuarios de teste de duas organizacoes;
- inventario dos workflows do n8n;
- definicao da branch de producao;
- preview da Vercel e testes automatizados aprovados.
