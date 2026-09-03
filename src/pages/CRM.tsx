import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Eye, ArrowLeft, Phone, Mail, User, MapPin, Wrench, Beer, ShoppingBag } from 'lucide-react';
import { useCRMCustomerSearch, shouldSearch } from '@/hooks/useCRMSearch';
import { useCustomerHistory, useCustomerAggregates } from '@/hooks/useCustomerHistory';
import { CustomerMetricsCards } from '@/components/crm/CustomerMetrics';
import { CustomerOrders } from '@/components/crm/CustomerOrders';
import { CustomerAddresses } from '@/components/crm/CustomerAddresses';
import { CustomerEquipmentHistory } from '@/components/crm/CustomerEquipmentHistory';
import { CustomerConsumptionSummary } from '@/components/crm/CustomerConsumptionSummary';
import { CustomerIntelligencePanel } from '@/components/crm/CustomerIntelligence';
import { Customer } from '@/types/database';
import { maskCPF, maskCNPJ } from '@/hooks/useInputMask';

function maskCpfPartial(cpf: string | null): string {
  if (!cpf) return 'Não informado';
  const digits = cpf.replace(/\D+/g, '');
  if (digits.length !== 11) return maskCPF(cpf);
  return `***.***.***-${digits.slice(-2)}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Não informado';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return 'Não informado';
  }
}

function displayName(c: Customer): string {
  if (c.person_type === 'PJ') {
    return c.trade_name || c.company_name || c.full_name;
  }
  return c.full_name;
}

export default function CRM() {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data, isFetching, isError, error } = useCRMCustomerSearch(term);
  const hasQuery = useMemo(() => shouldSearch(term), [term]);
  const results = data ?? [];

  if (selected) {
    return (
      <MainLayout>
        <SelectedCustomerView customer={selected} onBack={() => setSelected(null)} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">CRM Inteligente</h1>
          <p className="text-muted-foreground">
            Consulte o histórico e as informações dos seus clientes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, CPF, telefone ou e-mail..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {!hasQuery ? (
              <p className="py-8 text-center text-muted-foreground">
                Pesquise por nome, CPF, telefone ou e-mail para localizar um cliente.
              </p>
            ) : isFetching ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isError ? (
              <p className="py-8 text-center text-destructive">
                {(error as Error)?.message ?? 'Erro ao buscar clientes.'}
              </p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum cliente encontrado com os dados informados.
              </p>
            ) : (
              <>
                {/* Tabela: desktop/tablet */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((c) => (
                        <TableRow
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className="cursor-pointer"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {displayName(c)}
                              <Badge
                                variant={c.person_type === 'PJ' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {c.person_type || 'PF'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{c.phone || 'Não informado'}</TableCell>
                          <TableCell>{c.email || 'Não informado'}</TableCell>
                          <TableCell>{maskCpfPartial(c.cpf)}</TableCell>
                          <TableCell>{formatDate(c.created_at)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(c)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Visualizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Cards: mobile */}
                <div className="space-y-3 md:hidden">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{displayName(c)}</span>
                        <Badge
                          variant={c.person_type === 'PJ' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {c.person_type || 'PF'}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {c.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </div>
                        )}
                        <div>CPF: {maskCpfPartial(c.cpf)}</div>
                        <div>Cadastro: {formatDate(c.created_at)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  const display = value && String(value).trim() ? value : 'Não informado';
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? 'mt-1 whitespace-pre-wrap text-sm text-foreground'
            : 'mt-1 text-sm text-foreground'
        }
      >
        {display}
      </dd>
    </div>
  );
}

function SelectedCustomerView({
  customer,
  onBack,
}: {
  customer: Customer;
  onBack: () => void;
}) {
  const { data, isFetching, isError, error } = useCustomerHistory(customer.id);
  const orders = useMemo(() => data ?? [], [data]);
  const { metrics, addresses, equipment, consumption } = useCustomerAggregates(orders);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {displayName(customer)}
          </h1>
          <p className="text-muted-foreground">Ficha do cliente</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar à busca
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados cadastrais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome completo" value={customer.full_name} />
            <Field
              label="Tipo de pessoa"
              value={customer.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            />
            <Field label="Telefone" value={customer.phone} />
            <Field label="E-mail" value={customer.email} />
            <Field
              label={customer.person_type === 'PJ' ? 'CNPJ' : 'CPF'}
              value={
                customer.person_type === 'PJ'
                  ? customer.cnpj
                    ? maskCNPJ(customer.cnpj)
                    : null
                  : customer.cpf
                    ? maskCPF(customer.cpf)
                    : null
              }
            />
            <Field label="Data de cadastro" value={formatDate(customer.created_at)} />
            {customer.person_type === 'PJ' && (
              <>
                <Field label="Razão social" value={customer.company_name} />
                <Field label="Nome fantasia" value={customer.trade_name} />
              </>
            )}
            <div className="sm:col-span-2">
              <Field label="Observações" value={customer.notes} multiline />
            </div>
          </dl>
        </CardContent>
      </Card>

      {isFetching ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {(error as Error)?.message ?? 'Erro ao carregar histórico.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <CustomerMetricsCards metrics={metrics} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Histórico de Compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerOrders orders={orders} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereços utilizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerAddresses addresses={addresses} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Equipamentos utilizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerEquipmentHistory equipment={equipment} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beer className="h-5 w-5" />
                Consumo de chopp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerConsumptionSummary consumption={consumption} />
            </CardContent>
          </Card>

          <CustomerIntelligencePanel customerId={customer.id} />
        </>
      )}
    </div>
  );
}
