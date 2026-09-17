import { useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, BarChart3, Beer, DollarSign, Link2Off, ReceiptText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MainLayout } from '@/components/layout/MainLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHistoricalSales } from '@/hooks/useHistoricalSales';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export default function HistoricalSales() {
  const { data, isLoading, error } = useHistoricalSales();
  const [year, setYear] = useState('all');

  const years = useMemo(() => [...new Set((data?.monthly ?? []).map((item) => item.month.slice(0, 4)))].toSorted(), [data]);
  const monthly = useMemo(() => (data?.monthly ?? []).filter((item) => year === 'all' || item.month.startsWith(year)), [data, year]);
  const totals = useMemo(() => monthly.reduce((acc, item) => ({
    received: acc.received + (item.reported_paid_sales ?? 0),
    liters: acc.liters + (data?.products.filter((product) => product.month === item.month).reduce((sum, product) => sum + (product.liters ?? 0), 0) ?? 0),
    sales: acc.sales + item.sales_rows,
    expenses: acc.expenses + item.expense_rows,
    unlinked: acc.unlinked + item.unlinked_sales,
    duplicates: acc.duplicates + item.possible_duplicate_rows,
    missingPaid: acc.missingPaid + item.sales_missing_paid,
  }), { received: 0, liters: 0, sales: 0, expenses: 0, unlinked: 0, duplicates: 0, missingPaid: 0 }), [data, monthly]);
  const products = useMemo(() => {
    const result = new Map<string, { name: string; received: number; liters: number }>();
    for (const item of data?.products ?? []) {
      if (year !== 'all' && !item.month.startsWith(year)) continue;
      const current = result.get(item.product_name) ?? { name: item.product_name, received: 0, liters: 0 };
      current.received += item.received ?? 0;
      current.liters += item.liters ?? 0;
      result.set(item.product_name, current);
    }
    return [...result.values()].toSorted((a, b) => b.received - a.received).slice(0, 8);
  }, [data, year]);
  const chartData = monthly.map((item) => ({
    month: format(parseISO(item.month), 'MMM/yy', { locale: ptBR }),
    recebido: item.reported_paid_sales ?? 0,
    litros: data?.products.filter((product) => product.month === item.month).reduce((sum, product) => sum + (product.liters ?? 0), 0) ?? 0,
  }));

  return <MainLayout>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Histórico de vendas</h1>
          <p className="text-muted-foreground">Dados importados para análise, separados dos pedidos atuais.</p>
        </div>
        <div className="w-full sm:w-44">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger aria-label="Filtrar histórico por ano"><SelectValue placeholder="Todos os anos" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todo o histórico</SelectItem>{years.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Como ler estes dados</AlertTitle>
        <AlertDescription>“Recebido” vem da coluna PAGO. Valores ausentes e possíveis repetições continuam identificados; este histórico não cria cobranças, estoque ou pedidos atuais.</AlertDescription>
      </Alert>

      {isLoading ? <p className="text-muted-foreground">Carregando histórico...</p> : error ? <p className="text-destructive">Não foi possível carregar o histórico.</p> : <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Recebido" value={money.format(totals.received)} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} description="Soma de PAGO nas vendas" />
          <MetricCard title="Litros de bebidas" value={integer.format(totals.liters)} icon={<Beer className="h-4 w-4 text-amber-600" />} description="Exclui serviços e aquecedores" />
          <MetricCard title="Registros de venda" value={integer.format(totals.sales)} icon={<BarChart3 className="h-4 w-4 text-primary" />} description={`${integer.format(totals.expenses)} despesas separadas`} />
          <MetricCard title="Sem vínculo de cliente" value={integer.format(totals.unlinked)} icon={<Link2Off className="h-4 w-4 text-muted-foreground" />} description={`${integer.format(totals.missingPaid)} sem recebido e ${integer.format(totals.duplicates)} possíveis repetições`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3"><CardHeader><CardTitle>Recebido e volume por mês</CardTitle><CardDescription>Use períodos equivalentes nas comparações; 2012 e 2026 são parciais.</CardDescription></CardHeader><CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" minTickGap={24} /><YAxis yAxisId="money" tickFormatter={(value) => `R$ ${Math.round(value / 1000)}k`} /><YAxis yAxisId="liters" orientation="right" tickFormatter={(value) => `${Math.round(value / 1000)}k L`} /><Tooltip formatter={(value: number, name: string) => name === 'recebido' ? money.format(value) : `${integer.format(value)} L`} /><Bar yAxisId="money" dataKey="recebido" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} /><Bar yAxisId="liters" dataKey="litros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle>Produtos por recebido</CardTitle><CardDescription>Os nomes foram preservados como vieram da base.</CardDescription></CardHeader><CardContent className="space-y-4">
            {products.map((product) => <div key={product.name} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{product.name}</p><p className="text-sm text-muted-foreground">{integer.format(product.liters)} L</p></div><p className="whitespace-nowrap font-medium">{money.format(product.received)}</p></div>)}
          </CardContent></Card>
        </div>
      </>}
    </div>
  </MainLayout>;
}

function MetricCard({ title, value, icon, description }: { title: string; value: ReactNode; description: string }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}
