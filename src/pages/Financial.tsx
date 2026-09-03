import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFinancialData, useFinancialComparison, useMonthlyRevenue } from '@/hooks/useFinancial';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  CreditCard,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Lock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AccountBalancesPanel } from '@/components/financial/AccountBalancesPanel';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  transferencia: 'Transferência',
};

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function Financial() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  
  // Comparison periods
  const [compareMonth1, setCompareMonth1] = useState(now.getMonth() + 1);
  const [compareYear1, setCompareYear1] = useState(now.getFullYear());
  const [compareMonth2, setCompareMonth2] = useState(now.getMonth());
  const [compareYear2, setCompareYear2] = useState(now.getFullYear());

  const selectedDate = new Date(selectedYear, selectedMonth - 1, 1);
  const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

  const { data: financialData, isLoading } = useFinancialData(startDate, endDate);
  const { data: monthlyRevenue } = useMonthlyRevenue(selectedYear);

  const compare1Start = format(startOfMonth(new Date(compareYear1, compareMonth1 - 1, 1)), 'yyyy-MM-dd');
  const compare1End = format(endOfMonth(new Date(compareYear1, compareMonth1 - 1, 1)), 'yyyy-MM-dd');
  const compare2Start = format(startOfMonth(new Date(compareYear2, compareMonth2 - 1, 1)), 'yyyy-MM-dd');
  const compare2End = format(endOfMonth(new Date(compareYear2, compareMonth2 - 1, 1)), 'yyyy-MM-dd');
  
  const { period1, period2, isLoading: isComparing } = useFinancialComparison(
    compare1Start, compare1End, compare2Start, compare2End
  );

  const paymentChartData = financialData?.paymentsByMethod
    ? Object.entries(financialData.paymentsByMethod).map(([method, value]) => ({
        name: paymentMethodLabels[method] || method,
        value,
      }))
    : [];

  const chartData = monthlyRevenue?.map(item => ({
    name: monthNames[item.month - 1],
    receita: item.revenue,
  })) || [];

  const calculateChange = (current?: number, previous?: number) => {
    if (!current || !previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Painel Financeiro</h1>
            <p className="text-muted-foreground">Análise detalhada de receitas, custos e lucros</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="comparison">Comparação</TabsTrigger>
            <TabsTrigger value="accounts">Contas e extrato</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {(financialData?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {financialData?.orderCount || 0} pedidos no período
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {(financialData?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Produtos, despesas e taxas da empresa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lucro</CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    R$ {(financialData?.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Margem: {financialData?.totalRevenue ? ((financialData.profit / financialData.totalRevenue) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Volume Vendido</CardTitle>
                  <Package className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(financialData?.totalVolume || 0).toLocaleString('pt-BR')}L
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Litros de chopp vendidos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payment Status */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Status de Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Recebido</span>
                      <span className="font-bold text-green-600">
                        R$ {(financialData?.paidAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pendente</span>
                      <span className="font-bold text-amber-600">
                        R$ {(financialData?.pendingAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500"
                        style={{ 
                          width: `${financialData?.totalRevenue ? (financialData.paidAmount / financialData.totalRevenue) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Formas de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={paymentChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sem dados de pagamento</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {paymentChartData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Receita Mensal - {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']}
                    />
                    <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comparação de Períodos</CardTitle>
                <CardDescription>Compare o desempenho entre dois meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <div className="space-y-2">
                    <Label>Período 1</Label>
                    <div className="flex gap-2">
                      <Select value={compareMonth1.toString()} onValueChange={(v) => setCompareMonth1(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthNames.map((name, index) => (
                            <SelectItem key={index + 1} value={(index + 1).toString()}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={compareYear1.toString()} onValueChange={(v) => setCompareYear1(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Período 2</Label>
                    <div className="flex gap-2">
                      <Select value={compareMonth2.toString()} onValueChange={(v) => setCompareMonth2(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthNames.map((name, index) => (
                            <SelectItem key={index + 1} value={(index + 1).toString()}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={compareYear2.toString()} onValueChange={(v) => setCompareYear2(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {isComparing ? (
                  <p className="text-center text-muted-foreground">Carregando...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <ComparisonCard
                      title="Receita"
                      value1={period1?.totalRevenue || 0}
                      value2={period2?.totalRevenue || 0}
                      period1Label={`${monthNames[compareMonth1 - 1]}/${compareYear1}`}
                      period2Label={`${monthNames[compareMonth2 - 1]}/${compareYear2}`}
                    />
                    <ComparisonCard
                      title="Lucro"
                      value1={period1?.profit || 0}
                      value2={period2?.profit || 0}
                      period1Label={`${monthNames[compareMonth1 - 1]}/${compareYear1}`}
                      period2Label={`${monthNames[compareMonth2 - 1]}/${compareYear2}`}
                    />
                    <ComparisonCard
                      title="Volume (L)"
                      value1={period1?.totalVolume || 0}
                      value2={period2?.totalVolume || 0}
                      period1Label={`${monthNames[compareMonth1 - 1]}/${compareYear1}`}
                      period2Label={`${monthNames[compareMonth2 - 1]}/${compareYear2}`}
                      isCurrency={false}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="accounts" className="space-y-6">
            <AccountBalancesPanel endDate={endDate} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function ComparisonCard({ 
  title, 
  value1, 
  value2, 
  period1Label, 
  period2Label,
  isCurrency = true 
}: { 
  title: string; 
  value1: number; 
  value2: number;
  period1Label: string;
  period2Label: string;
  isCurrency?: boolean;
}) {
  const change = value2 > 0 ? ((value1 - value2) / value2) * 100 : 0;
  const isPositive = change >= 0;

  const formatValue = (value: number) => {
    if (isCurrency) {
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    return value.toLocaleString('pt-BR');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{period1Label}</span>
            <span className="font-bold">{formatValue(value1)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{period2Label}</span>
            <span className="font-bold">{formatValue(value2)}</span>
          </div>
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(change).toFixed(1)}% vs período anterior
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
