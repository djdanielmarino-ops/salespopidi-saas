import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreateFinancialAccount, useCreatePaymentMethodConfig, useFinancialAccounts, usePaymentMethodConfigs } from '@/hooks/useFinancialAccounts';
import { FinancialAccountType, FeePayer, PaymentMethod } from '@/types/database';
import { Plus } from 'lucide-react';

const accountTypes: Record<FinancialAccountType, string> = { cash: 'Dinheiro / Caixa', checking: 'Conta corrente', digital_wallet: 'Conta digital', other: 'Outra' };
const baseMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'PIX' },
  { value: 'cartao_debito', label: 'Cartão de débito' }, { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
];
const currency = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function FinancialSettings({ canManage }: { canManage: boolean }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const { data: accounts } = useFinancialAccounts(false);
  const { data: methods } = usePaymentMethodConfigs(false);
  const createAccount = useCreateFinancialAccount();
  const createMethod = useCreatePaymentMethodConfig();

  const addAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await createAccount.mutateAsync({
      name: String(f.get('name')), account_type: String(f.get('account_type')) as FinancialAccountType,
      bank_name: String(f.get('bank_name') || '') || null, opening_balance: Number(f.get('opening_balance')) || 0,
      opening_balance_date: String(f.get('opening_balance_date')), color: null, notes: String(f.get('notes') || '') || null, is_active: true,
    });
    setAccountOpen(false);
  };

  const addMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await createMethod.mutateAsync({
      name: String(f.get('name')), base_method: String(f.get('base_method')) as PaymentMethod,
      default_account_id: String(f.get('default_account_id')), fee_percentage: Number(f.get('fee_percentage')) || 0,
      fee_fixed: Number(f.get('fee_fixed')) || 0, fee_payer: String(f.get('fee_payer')) as FeePayer,
      settlement_days: Number(f.get('settlement_days')) || 0, is_active: true,
    });
    setMethodOpen(false);
  };

  return <div className="space-y-6">
    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Contas financeiras</CardTitle><CardDescription>Contas bancárias, carteiras e caixa usados nas entradas e saídas.</CardDescription></div>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogTrigger asChild><Button disabled={!canManage}><Plus className="mr-2 h-4 w-4"/>Nova conta</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Nova conta financeira</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={addAccount}><div><Label>Nome *</Label><Input name="name" required placeholder="Ex: Sicoob"/></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Tipo *</Label><Select name="account_type" defaultValue="checking"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(accountTypes).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div><div><Label>Banco</Label><Input name="bank_name"/></div></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Saldo inicial</Label><Input name="opening_balance" type="number" step="0.01" defaultValue="0"/></div><div><Label>Data do saldo *</Label><Input name="opening_balance_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></div></div>
          <div><Label>Observações</Label><Input name="notes"/></div><div className="flex justify-end"><Button disabled={createAccount.isPending}>Salvar</Button></div></form>
      </DialogContent></Dialog></div></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Conta</TableHead><TableHead>Tipo</TableHead><TableHead>Banco</TableHead><TableHead>Saldo inicial</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{accounts?.map(a=><TableRow key={a.id}><TableCell className="font-medium">{a.name}</TableCell><TableCell>{accountTypes[a.account_type]}</TableCell><TableCell>{a.bank_name || '—'}</TableCell><TableCell>{currency(a.opening_balance)}</TableCell><TableCell>{a.is_active ? 'Ativa' : 'Inativa'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Formas de pagamento e taxas</CardTitle><CardDescription>O valor da venda não muda. A regra define somente a taxa descontada e o líquido da conta.</CardDescription></div>
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}><DialogTrigger asChild><Button disabled={!canManage || !accounts?.some(a=>a.is_active)}><Plus className="mr-2 h-4 w-4"/>Nova forma</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Nova forma de pagamento</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={addMethod}><div><Label>Nome *</Label><Input name="name" required placeholder="Ex: Crédito Stone"/></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Tipo *</Label><Select name="base_method" defaultValue="pix"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{baseMethods.map(m=><SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Conta de destino *</Label><Select name="default_account_id" required><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{accounts?.filter(a=>a.is_active).map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Taxa percentual (%)</Label><Input name="fee_percentage" type="number" min="0" max="100" step="0.0001" defaultValue="0"/></div><div><Label>Taxa fixa (R$)</Label><Input name="fee_fixed" type="number" min="0" step="0.01" defaultValue="0"/></div></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Quem paga a taxa *</Label><Select name="fee_payer" defaultValue="company"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="company">Empresa</SelectItem><SelectItem value="customer">Cliente</SelectItem></SelectContent></Select></div><div><Label>Prazo (dias)</Label><Input name="settlement_days" type="number" min="0" defaultValue="0"/></div></div>
          <div className="flex justify-end"><Button disabled={createMethod.isPending}>Salvar</Button></div></form>
      </DialogContent></Dialog></div></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Forma</TableHead><TableHead>Conta</TableHead><TableHead>Taxa</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader><TableBody>{methods?.map(m=><TableRow key={m.id}><TableCell className="font-medium">{m.name}</TableCell><TableCell>{m.financial_accounts?.name}</TableCell><TableCell>{Number(m.fee_percentage).toLocaleString('pt-BR')}%{Number(m.fee_fixed)>0 ? ` + ${currency(m.fee_fixed)}` : ''}</TableCell><TableCell>{m.fee_payer === 'company' ? 'Empresa' : 'Cliente'}</TableCell><TableCell>{m.settlement_days === 0 ? 'Imediato' : `${m.settlement_days} dias`}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
