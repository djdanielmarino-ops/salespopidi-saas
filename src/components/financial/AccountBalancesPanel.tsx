import { FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountLedger, useFinancialAccounts, useTransferBetweenAccounts } from '@/hooks/useFinancialAccounts';
import { ArrowLeftRight, Landmark } from 'lucide-react';

const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function AccountBalancesPanel({ endDate }: { endDate: string }) {
  const { data: accounts } = useFinancialAccounts();
  const { data: ledger } = useAccountLedger(endDate);
  const transfer = useTransferBetweenAccounts();
  const balances = accounts?.map(account => {
    const opening = account.opening_balance_date <= endDate ? Number(account.opening_balance) : 0;
    const entries = ledger?.filter(item => item.account_id === account.id) || [];
    return {
      ...account,
      confirmed: opening + entries.filter(item => item.status === 'confirmed').reduce((sum, item) => sum + Number(item.net_amount), 0),
      projected: opening + entries.reduce((sum, item) => sum + Number(item.net_amount), 0),
      pending: entries.filter(item => item.status === 'expected').reduce((sum, item) => sum + Number(item.net_amount), 0),
    };
  }) || [];

  const submitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await transfer.mutateAsync({ fromAccount: String(f.get('from')), toAccount: String(f.get('to')), amount: Number(f.get('amount')), date: String(f.get('date')), description: String(f.get('description') || 'Transferência entre contas') });
  };

  return <div className="space-y-6">
    <div className="flex justify-end"><Dialog><DialogTrigger asChild><Button><ArrowLeftRight className="mr-2 h-4 w-4"/>Transferir entre contas</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Transferência entre contas</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={submitTransfer}><div className="grid grid-cols-2 gap-4"><div><Label>Origem *</Label><Select name="from" required><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{accounts?.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Destino *</Label><Select name="to" required><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{accounts?.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="grid grid-cols-2 gap-4"><div><Label>Valor *</Label><Input name="amount" type="number" min="0.01" step="0.01" required/></div><div><Label>Data *</Label><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></div></div><div><Label>Descrição</Label><Input name="description"/></div><div className="flex justify-end"><Button disabled={transfer.isPending}>Registrar</Button></div></form>
    </DialogContent></Dialog></div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{balances.map(account => <Card key={account.id}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4"/>{account.name}</CardTitle><CardDescription>Posição até {new Date(`${endDate}T00:00:00`).toLocaleDateString('pt-BR')}</CardDescription></CardHeader><CardContent className="space-y-2"><div><p className="text-xs text-muted-foreground">Saldo confirmado</p><p className="text-xl font-bold">{money(account.confirmed)}</p></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">A receber</span><span>{money(account.pending)}</span></div><div className="flex justify-between border-t pt-2 font-medium"><span>Saldo previsto</span><span>{money(account.projected)}</span></div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Histórico de movimentações</CardTitle><CardDescription>Fotografia permanente das entradas, taxas, saídas e transferências.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead>Bruto</TableHead><TableHead>Taxa descontada</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow></TableHeader><TableBody>{ledger?.map(item=><TableRow key={item.id}><TableCell>{new Date(`${item.effective_date}T00:00:00`).toLocaleDateString('pt-BR')}</TableCell><TableCell>{item.financial_accounts?.name}</TableCell><TableCell>{item.description}</TableCell><TableCell>{item.status === 'confirmed' ? 'Confirmado' : 'Previsto'}</TableCell><TableCell>{money(Number(item.gross_amount))}</TableCell><TableCell>{money(Number(item.fee_amount))}</TableCell><TableCell className={`text-right font-medium ${Number(item.net_amount)<0?'text-red-600':'text-green-600'}`}>{money(Number(item.net_amount))}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
