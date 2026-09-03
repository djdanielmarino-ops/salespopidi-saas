import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ACCESS_MODULES, AccessLevel, UserPermissions, UserProfile } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Draft = Pick<UserProfile, 'user_id' | 'name' | 'email' | 'role' | 'is_active' | 'permissions'>;
const blankPermissions = () => ({
  ...Object.fromEntries(ACCESS_MODULES.map(({ key }) => [key, 'none'])),
  dashboard: 'view',
}) as UserPermissions;

async function manageUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function UserManagement() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const usersQuery = useQuery({
    queryKey: ['managed-users'],
    queryFn: async () => (await manageUsers({ action: 'list' })).users as UserProfile[],
  });
  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => manageUsers(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['managed-users'] });
      setOpen(false);
      setDraft(null);
      toast.success(draft?.user_id ? 'Acesso atualizado.' : 'Convite enviado ao funcionário.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const newUser = () => {
    setDraft({ user_id: '', name: '', email: '', role: 'employee', is_active: true, permissions: blankPermissions() });
    setOpen(true);
  };
  const editUser = (user: UserProfile) => {
    setDraft({ ...user, permissions: { ...blankPermissions(), ...(user.permissions || {}) } });
    setOpen(true);
  };
  const setAccess = (key: string, level: AccessLevel) => setDraft((current) => current && ({
    ...current,
    permissions: { ...current.permissions, [key]: level },
  }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    save.mutate({ action: draft.user_id ? 'update' : 'invite', ...draft });
  };

  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-4">
      <div>
        <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />Funcionários e acessos</CardTitle>
        <CardDescription>Convide usuários e defina o que cada pessoa pode visualizar ou gerenciar.</CardDescription>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button onClick={newUser}><Plus className="mr-2 h-4 w-4" />Novo funcionário</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.user_id ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle></DialogHeader>
          {draft && <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome</Label><Input required value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input required type="email" disabled={!!draft.user_id} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Perfil</Label><Select value={draft.role} onValueChange={(role: 'admin' | 'employee') => setDraft({ ...draft, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Funcionário</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>
              {draft.user_id && <div className="flex items-end gap-3 pb-2"><Switch checked={draft.is_active} onCheckedChange={(is_active) => setDraft({ ...draft, is_active })} /><Label>Usuário ativo</Label></div>}
            </div>
            {draft.role === 'employee' && <div className="space-y-3">
              <div><Label className="text-base">Permissões por módulo</Label><p className="text-sm text-muted-foreground">“Gerenciar” libera as funções de cadastro e alteração do módulo.</p></div>
              <div className="divide-y rounded-lg border">
                {ACCESS_MODULES.map((module) => <div key={module.key} className="flex items-center justify-between gap-4 p-3">
                  <span className="font-medium">{module.label}</span>
                  <Select value={draft.permissions[module.key] || 'none'} onValueChange={(value: AccessLevel) => setAccess(module.key, value)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem acesso</SelectItem><SelectItem value="view">Somente visualizar</SelectItem><SelectItem value="manage">Gerenciar</SelectItem></SelectContent></Select>
                </div>)}
              </div>
            </div>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={save.isPending}>{draft.user_id ? 'Salvar alterações' : 'Enviar convite'}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
    </CardHeader>
    <CardContent>
      <Table><TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>{usersQuery.data?.map((user) => <TableRow key={user.user_id}><TableCell><div className="font-medium">{user.name || 'Sem nome'}</div><div className="text-sm text-muted-foreground">{user.email}</div></TableCell><TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role === 'admin' ? <><Shield className="mr-1 h-3 w-3" />Administrador</> : 'Funcionário'}</Badge></TableCell><TableCell><Badge variant={user.is_active ? 'outline' : 'destructive'}>{user.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => editUser(user)}>Editar acessos</Button></TableCell></TableRow>)}</TableBody>
      </Table>
      {!usersQuery.isLoading && !usersQuery.data?.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>}
    </CardContent>
  </Card>;
}
