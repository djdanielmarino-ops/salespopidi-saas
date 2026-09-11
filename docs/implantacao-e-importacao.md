# Implantação e importação de dados

## Decisão arquitetural

A importação inicial será um recurso do próprio Sales Popidi, em **Configurações > Importação inicial**. O processo usa três camadas:

1. **Codex**: preparação assistida para fontes irregulares, planilhas antigas e conversões especiais. Não grava diretamente no banco do cliente.
2. **Aplicação**: fornece o modelo oficial, recebe o CSV, mostra a validação e exige confirmação de um administrador.
3. **Supabase**: guarda o lote temporário, aplica autorização multiempresa e confirma os registros em uma transação.

Esse desenho permite repetir o processo de implantação com segurança sem transformar o Codex ou o painel do Supabase em uma etapa obrigatória da operação diária.

## Escopo do primeiro fluxo

- Clientes.
- Equipamentos individualizados: barris, chopeiras e cilindros.
- Vendas históricas consolidadas.
- Até 2.000 linhas por lote.
- Arquivo CSV UTF-8, com `;` ou `,` como separador.
- Acesso restrito a proprietário ou administrador da organização e ao proprietário da plataforma.

O Excel pode abrir e salvar os modelos CSV. A leitura direta de `.xlsx` fica para uma evolução posterior, evitando adicionar agora uma dependência grande apenas para uma operação rara.

## Segurança e isolamento

- Todo lote possui `organization_id` e `created_by`.
- Tabelas de preparação usam RLS e não permitem escrita direta pelo navegador.
- A Edge Function valida o JWT e a função do usuário antes de usar a chave de serviço.
- A confirmação chama uma função transacional acessível somente a `service_role`.
- Lotes com uma linha inválida não podem ser confirmados pela interface.
- A conclusão gera evento em `audit_logs`.
- O limite por lote reduz risco de abuso e estouro de memória.

## Tratamento por domínio

### Clientes

Os dados são gravados na tabela operacional `customers`. CPF/CNPJ e telefone são normalizados para dígitos. Nome e telefone são obrigatórios. O banco continua sendo a última barreira contra CPF/CNPJ duplicado na mesma organização.

O modelo inclui também `email`, `rg`, `data_nascimento`, `cep`, `endereco`, `numero`, `complemento`, `bairro`, `cidade` e `estado`, além de tipo de pessoa, CPF/CNPJ, razão social, nome fantasia e observações. Os campos adicionais são opcionais; arquivos antigos continuam aceitos. Nascimento aceita DD/MM/AAAA ou AAAA-MM-DD e exige uma data válida. CEP aceita pontuação e deve ter oito dígitos; estado usa uma sigla de UF, como SP. Endereço corresponde ao logradouro; número e complemento têm colunas próprias.

Para disponibilizar esses campos, publique em conjunto a migração `extend_customer_import_fields`, a função `onboarding-imports` e o frontend. Lotes validados antes da atualização devem ser reenviados e validados novamente para incluir os novos campos.

### Equipamentos

Cada bem entra na tabela operacional correspondente (`barrels`, `taps` ou `cylinders`) com um código patrimonial único por organização. Barris exigem capacidade em litros. O saldo físico inicial deve ser conferido depois no controle patrimonial de barris.

### Vendas históricas

Vendas antigas são gravadas em `imported_sales_history`, separadas de `orders`. Essa é uma decisão intencional: importar o passado não deve disparar baixa de produtos, envio de barris, cobrança, NFe ou qualquer automação operacional.

Quando os relatórios históricos forem implementados, eles poderão consolidar `orders` e `imported_sales_history` na camada de leitura, preservando a diferença entre fatos importados e operações nativas.

## Fluxo operacional

1. Selecionar o conteúdo e baixar o modelo.
2. Copiar os dados do sistema anterior sem alterar os cabeçalhos.
3. Enviar o CSV e revisar a quantidade de linhas.
4. Validar.
5. Corrigir o arquivo se houver erros; a validação não grava nos cadastros.
6. Confirmar o lote sem pendências.
7. Conferir amostras nos cadastros e no histórico de lotes.

## Limitações e próximas evoluções

- A primeira versão exige o modelo oficial; mapeamento visual de colunas será uma evolução.
- Duplicidades dentro do arquivo são detectadas. Conflitos com dados já existentes continuam protegidos pelas restrições do banco e fazem a transação falhar sem importação parcial.
- Não há exclusão automática de lotes concluídos nem rollback pela interface. Uma reversão precisa considerar vínculos criados depois da importação e deve ser executada com análise administrativa.
- Para bases grandes, dividir os arquivos em lotes de até 2.000 linhas.
- Antes de uma implantação real, usar uma cópia do arquivo de origem e fazer primeiro um lote pequeno de homologação.

## Sistema antigo

Nenhuma conexão, tabela ou código do sistema antigo é alterado. Ele serve somente como fonte de exportação. A importação ocorre no projeto SaaS atual e mantém rastreabilidade própria.
