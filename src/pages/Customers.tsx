import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustomers, useDeleteCustomer } from '@/hooks/useCustomers';
import { Customer } from '@/types/database';
import { Pencil, Trash2, Search, Phone, Mail } from 'lucide-react';
import { CSVImportDialog } from '@/components/import/CSVImportDialog';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { Badge } from '@/components/ui/badge';
import { maskCPF, maskCNPJ } from '@/hooks/useInputMask';

export default function Customers() {
  const [search, setSearch] = useState('');
  const { data: customers, isLoading } = useCustomers();
  const deleteCustomer = useDeleteCustomer();

  const filteredCustomers = customers?.filter(c => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.cpf?.includes(search) ||
      c.cnpj?.includes(search) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.trade_name?.toLowerCase().includes(q) ||
      c.phone.includes(search)
    );
  });

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  const formatDocument = (customer: Customer) => {
    if (customer.person_type === 'PJ' && customer.cnpj) {
      return maskCNPJ(customer.cnpj);
    }
    if (customer.cpf) return maskCPF(customer.cpf);
    return '-';
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Clientes</h1>
            <p className="text-muted-foreground">Gerencie sua base de clientes</p>
          </div>
          <div className="flex gap-2">
            <CSVImportDialog />
            <CustomerFormDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, CNPJ ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Badge variant={customer.person_type === 'PJ' ? 'secondary' : 'outline'} className="text-xs">
                          {customer.person_type || 'PF'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer.person_type === 'PJ'
                          ? (customer.trade_name || customer.company_name || customer.full_name)
                          : customer.full_name}
                      </TableCell>
                      <TableCell>
                        <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </a>
                      </TableCell>
                      <TableCell>
                        {customer.email && (
                          <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-primary hover:underline">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>{formatDocument(customer)}</TableCell>
                      <TableCell>{customer.city || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CustomerFormDialog
                            customer={customer}
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
