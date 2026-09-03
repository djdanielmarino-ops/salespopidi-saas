# Auditoria de infraestrutura e resolução multiempresa

Data da auditoria: 3 de setembro de 2026.

## Escopo e garantia de isolamento

Este repositório é a nova base `salespopidi-saas`. A implementação foi feita somente nele. Nenhum arquivo, banco, deploy ou domínio do sistema antigo foi alterado. A mudança também não foi aplicada ao Supabase remoto nem publicada na Vercel.

Foi preservada uma modificação local preexistente em `supabase/functions/mcp/index.ts`, que não faz parte desta entrega.

## Evidências encontradas

### GitHub

- branch local: `main`;
- remoto configurado: `https://github.com/djdanielmarino-ops/salespopidi-saas.git`;
- commit visível no checkout: `f575b00 chore: iniciar base do SaaS multiempresa`;
- confirmação remota autenticada: **não concluída**, pois o ambiente não possui GitHub CLI nem o helper Git HTTPS operacional.

Portanto, está confirmado o vínculo configurado no Git, mas não o estado atual do repositório remoto ou de suas proteções.

### Vercel

- aplicação compatível com build estático Vite (`npm run build`, saída `dist`);
- não havia `.vercel/project.json`, então este checkout não está vinculado a um projeto Vercel;
- não foi possível confirmar conta, projeto, deploy de produção, variáveis ou domínios por acesso autenticado;
- foi adicionado `vercel.json` apenas com fallback de rotas da SPA.

Para subdomínios dinâmicos, o projeto deverá receber `*.DOMINIO_BASE` como domínio wildcard. A Vercel exige verificação por nameservers para wildcard. O domínio raiz continua separado e não é interpretado como empresa.

### Supabase

- projeto declarado em `supabase/config.toml`: `okwmroasuvoopbrwmhym`;
- cliente web usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`;
- dependência `@supabase/supabase-js` está fixada pelo lockfile em `2.90.1`;
- as migrações existentes criam `organizations.slug`, `organization_members` e RLS que permite consultar uma organização somente se o usuário autenticado for membro ativo;
- confirmação autenticada do schema remoto, migrations aplicadas, advisors e backup: **não concluída**; a CLI Supabase não está instalada/vinculada neste ambiente.

Foi tentada a leitura do changelog atual, mas o endpoint Markdown não foi aceito pelo cliente de documentação deste ambiente. Como esta entrega não cria nem aplica schema novo, ela se limita a reutilizar o `slug` e as políticas RLS já versionadas; qualquer alteração remota futura exige nova verificação do changelog e dos advisors.

## Decisões de arquitetura

### 1. Slug como identidade canônica do subdomínio

`organizations.slug` continua sendo a fonte de verdade. O host `acme.app.exemplo.com` produz o slug `acme`. Não se grava hostname no JWT, em `user_metadata` ou em armazenamento local.

### 2. Host identifica contexto; RLS autoriza acesso

O navegador extrai o slug, mas isso não concede acesso. Depois do login, o frontend consulta `organizations` por slug. A política `organizations_select` só retorna a linha se o usuário for membro ou administrador de plataforma. Assim, um slug manipulado resulta em “não existe ou sem acesso”, sem enumerar empresas.

### 3. Falha fechada

Hosts fora de `VITE_APP_BASE_DOMAIN`, domínios de preview, múltiplos níveis (`a.b.dominio`) e slugs inválidos não são associados a empresa. Rotas protegidas são bloqueadas antes da renderização funcional.

### 4. Desenvolvimento explícito

- `empresa.localhost` funciona sem configuração;
- `localhost` e IP local só resolvem empresa quando `VITE_DEV_TENANT_SLUG` estiver definido;
- o override é ignorado em build de produção.

### 5. Login permanece público, operação exige empresa

Login, recuperação de senha e consentimento OAuth permanecem acessíveis para completar autenticação. Todas as rotas operacionais passam por `AuthGuard`, depois `TenantGuard` e somente então pelo controle de permissões existente.

### 6. Base, não conclusão da migração

O contexto expõe a organização ativa para os próximos incrementos, mas esta entrega não adiciona automaticamente `organization_id` às queries existentes. O isolamento definitivo dos dados operacionais continua dependendo da conclusão das etapas de schema/RLS descritas em `plano-migracao-multiempresa.md`.

## Contrato de configuração

| Variável | Ambiente | Função |
|---|---|---|
| `VITE_APP_BASE_DOMAIN` | Preview/produção | domínio sem protocolo, por exemplo `app.exemplo.com` |
| `VITE_DEV_TENANT_SLUG` | desenvolvimento | slug explícito ao usar `localhost` |
| `VITE_SUPABASE_URL` | todos | URL do projeto correspondente ao ambiente |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | todos | chave publicável; nunca `service_role` |

## Checklist antes de ativar tráfego

1. criar um projeto Vercel separado para o SaaS e vinculá-lo ao repositório novo;
2. configurar `VITE_APP_BASE_DOMAIN`, URL e chave publicável do Supabase por ambiente;
3. adicionar e verificar o domínio raiz e o wildcard na Vercel;
4. incluir URLs de callback por wildcard/ambiente na configuração de Auth do Supabase;
5. confirmar que as migrações de controle SaaS estão aplicadas em homologação;
6. criar duas organizações e dois usuários de teste, validando acesso permitido e negado;
7. executar Supabase advisors e testar backup/restauração;
8. concluir RLS das tabelas operacionais antes de admitir a segunda empresa;
9. só então promover o projeto novo, mantendo DNS e deploy do sistema antigo intactos.

## Critérios automatizados cobertos

Os testes de `tenantHost` cobrem subdomínio válido, domínio raiz, localhost, override de desenvolvimento, host externo, subdomínio profundo e slug inválido. O build valida a integração TypeScript/React e o fallback Vercel cobre rotas diretas da SPA.

Resultados desta entrega:

- teste isolado da resolução: 5 testes aprovados;
- build Vite de produção: aprovado;
- lint somente dos arquivos alterados: sem erros (um aviso preexistente da regra de Fast Refresh sobre exportar hook e provider juntos);
- `git diff --check`: aprovado;
- suíte completa: 7 testes passaram e 2 arquivos falharam antes de executar os casos porque o ambiente de teste não fornece `VITE_SUPABASE_URL`/chave ao cliente existente;
- lint global: 68 erros e 9 avisos preexistentes, distribuídos em arquivos fora do escopo desta base;
- bundle atual: aproximadamente 1,41 MB minificado (385 KB gzip), acima do alerta de 500 KB do Vite e candidato a code splitting futuro.

## Primeira entrega do painel master

A rota `/master` possui uma guarda própria, independente do contexto de subdomínio, e consulta `platform_admins` sob RLS. Somente um `platform_owner` ativo pode renderizar a interface. O menu exibe a entrada global apenas para esse papel.

O primeiro incremento permite:

- visualizar todas as organizações e indicadores de situação;
- cadastrar uma organização inicialmente em `trial`;
- definir o slug que formará `{slug}.app.popidichopp.online`;
- alterar os estados previstos pelo controle SaaS.

Não foram incluídos neste incremento vínculo de proprietário, planos, módulos, assinatura ou exclusão. Essas operações serão adicionadas com fluxos explícitos e trilha de auditoria; não devem ser improvisadas como mutações genéricas no frontend.
