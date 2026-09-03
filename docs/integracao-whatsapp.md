# Integracao de WhatsApp por organizacao

## Principio

Cada loja, distribuidora ou cervejaria conecta e autoriza o proprio numero. A plataforma nao deve compartilhar sessao, token, templates, contatos ou historico de mensagens entre organizacoes.

O n8n continua como orquestrador, enquanto o SaaS mantem a fonte de verdade sobre organizacao, consentimento, evento disparador, status e auditoria.

## Fluxo de ativacao

1. o administrador da organizacao abre Integracoes > WhatsApp;
2. inicia uma sessao WAHA exclusiva para sua organizacao ou unidade;
3. conclui a leitura do QR code fora do frontend do SaaS;
4. o backend recebe a confirmacao e grava apenas a referencia segura da credencial;
5. o sistema valida o numero com uma mensagem de teste;
6. a conexao passa para `connected` e os fluxos habilitados podem enviar mensagens;
7. desconexao, expiracao ou erro de autenticacao suspendem os envios e notificam os administradores.

## Modelo proposto

### `integration_connections`

- `organization_id` e, opcionalmente, `unit_id`;
- `provider`: provedor tecnico;
- `capability`: `whatsapp`, `nfe`, `payments` ou outra;
- `status`: `pending`, `connected`, `degraded`, `disconnected` ou `revoked`;
- identificador externo da instancia ou conta;
- numero verificado e nome exibido;
- referencia para o segredo no backend;
- datas de verificacao, expiracao e ultima falha;
- configuracao nao sensivel em JSON validado.

### `message_automations`

- evento disparador;
- canal e template;
- regras de horario e atraso;
- unidades e tipos de pedido aplicaveis;
- situacao ativa/inativa;
- versao do template e variaveis aceitas.

### `message_deliveries`

- organizacao, destinatario mascarado e pedido relacionado;
- evento e chave de idempotencia;
- status de fila, envio, entrega, leitura ou falha;
- identificador do provedor;
- tentativas e proxima tentativa;
- erro sanitizado e timestamps.

## Contrato com o n8n

O SaaS envia um evento assinado contendo identificadores e dados minimos. O n8n resolve o workflow, chama o provedor autorizado daquela organizacao e devolve um resultado correlacionado pelo `event_id`.

Requisitos:

- nunca enviar token de WhatsApp no payload do navegador;
- assinatura HMAC e rotacao de segredo;
- `event_id` unico para impedir duplicidade;
- callbacks autenticados;
- timeout e repeticao controlados;
- armazenamento de erros sem registrar credenciais;
- limite de envio por organizacao e por numero;
- opcao de pausar automacoes sem desconectar o numero.

## Automacoes iniciais

- confirmacao de pedido;
- lembrete de entrega ou retirada;
- aviso de saida para entrega;
- confirmacao de recebimento;
- lembrete de devolucao de barris, cilindros e chopeiras;
- cobranca e segunda via;
- pesquisa de satisfacao;
- notificacao B2B entre loja e cervejaria.

## Cuidados operacionais

- registrar consentimento e respeitar opt-out;
- aplicar janela de horario configuravel;
- usar templates aprovados quando o provedor exigir;
- separar mensagens transacionais de campanhas;
- impedir disparos em massa por usuarios sem permissao;
- monitorar qualidade do numero, taxa de falha e bloqueios;
- exibir claramente quem desconectou, reconectou ou alterou a integracao.

## Provedor inicial: WAHA

O provedor inicial e o WAHA, orquestrado pelo n8n. Cada organizacao tera uma sessao identificada por um nome tecnico nao previsivel. O identificador da sessao pode ficar na configuracao da conexao, mas chaves de API e credenciais permanecem exclusivamente no backend.

O SaaS controla a autorizacao e a auditoria; o n8n executa os workflows; o WAHA mantem a sessao do WhatsApp. A camada de conexoes permanece neutra para permitir uma futura troca de provedor sem reescrever pedidos, clientes ou automacoes.
