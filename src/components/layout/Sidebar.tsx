import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Users, 
  ShoppingCart, 
  Beer, 
  Package, 
  Cylinder as CylinderIcon,
  BarChart3,
  ReceiptText,
  Settings,
  LogOut,
  Loader2,
  UserSearch,
  ShieldCheck,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlatformAccess } from '@/hooks/usePlatformAccess';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home, module: 'dashboard', action: 'view' },
  { name: 'Novo Pedido', href: '/orders/new', icon: ShoppingCart, module: 'orders', action: 'manage' },
  { name: 'Pedidos', href: '/orders', icon: Package, module: 'orders', action: 'view' },
  { name: 'Clientes', href: '/customers', icon: Users, module: 'customers', action: 'view' },
  { name: 'Estoque', href: '/inventory', icon: BarChart3, module: 'inventory', action: 'view' },
  { name: 'Produtos', href: '/products', icon: Package, module: 'inventory', action: 'view' },
  { name: 'Chopeiras', href: '/taps', icon: Beer, module: 'taps', action: 'view' },
  { name: 'Barris', href: '/barrels', icon: Package, module: 'barrels', action: 'view' },
  { name: 'Pedidos à Cervejaria', href: '/brewery-orders', icon: Send, module: 'barrels', action: 'view' },
  { name: 'Cilindros', href: '/cylinders', icon: CylinderIcon, module: 'cylinders', action: 'view' },
  { name: 'Financeiro', href: '/financial', icon: BarChart3, module: 'financial', action: 'view' },
  { name: 'Custos', href: '/costs', icon: ReceiptText, module: 'costs', action: 'view' },
  { name: 'CRM Inteligente', href: '/crm', icon: UserSearch, module: 'crm', action: 'view' },
  { name: 'Configurações', href: '/settings', icon: Settings, module: 'settings', action: 'view' },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut, loading } = useAuth();
  const { can } = usePermissions();
  const { isPlatformOwner } = usePlatformAccess();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      onNavigate?.();
      navigate('/auth');
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        <img src={logo} alt="Popidi Chopp" className="h-10 w-auto" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {isPlatformOwner && (
          <NavLink to="/master" onClick={onNavigate} className={({ isActive }) => cn('mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'border border-primary/20 text-primary hover:bg-primary/10')}>
            <ShieldCheck className="h-5 w-5 shrink-0" />Painel Master
          </NavLink>
        )}
        {navigation.filter((item) => can(item.module, item.action as 'view' | 'manage')).map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        {user && (
          <div className="truncate px-3 text-xs text-sidebar-foreground/70">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={handleLogout}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          Sair
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border lg:block">
      <SidebarContent />
    </aside>
  );
}
