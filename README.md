# Sales Popidi

Plataforma SaaS para operacoes de lojas, distribuidoras e cervejarias, com estoque, pedidos, ativos retornaveis, financeiro, NFe e automacoes.

## Stack

- React, Vite e TypeScript
- Supabase (Postgres, Auth e Edge Functions)
- Vercel para deploy e previews
- n8n para orquestracao de automacoes

## Desenvolvimento local

Requisitos: Node.js e npm.

```sh
npm install
npm run dev
```

As variaveis locais devem ser configuradas em `.env` e nunca commitadas. O frontend usa somente a URL e a chave publica do Supabase; segredos de integracoes pertencem ao backend.

## Documentacao de arquitetura

- [Arquitetura SaaS](docs/arquitetura-saas.md)
- [Plano de migracao multiempresa](docs/plano-migracao-multiempresa.md)
- [Integracao de WhatsApp](docs/integracao-whatsapp.md)

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm test
```

## Regra de seguranca

Nenhuma funcionalidade pode depender apenas de filtros do frontend para separar empresas. Toda tabela operacional exposta deve ter isolamento por organizacao aplicado por Row Level Security no Postgres.
