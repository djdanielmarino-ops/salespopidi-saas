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
  UserSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Novo Pedido', href: '/orders/new', icon: ShoppingCart },
  { name: 'Pedidos', href: '/orders', icon: Package },
  { name: 'Clientes', href: '/customers', icon: Users },
  { name: 'Estoque', href: '/inventory', icon: BarChart3 },
  { name: 'Chopeiras', href: '/taps', icon: Beer },
  { name: 'Barris', href: '/barrels', icon: Package },
  { name: 'Cilindros', href: '/cylinders', icon: CylinderIcon },
  { name: 'Financeiro', href: '/financial', icon: BarChart3 },
  { name: 'Custos', href: '/costs', icon: ReceiptText },
  { name: 'CRM Inteligente', href: '/crm', icon: UserSearch },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      navigate('/auth');
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        <img src={logo} alt="Popidi Chopp" className="h-10 w-auto" />
      </div>
      <nav className="flex flex-col gap-1 p-4 flex-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      {/* User info and logout */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        {user && (
          <div className="text-xs text-sidebar-foreground/70 truncate px-3">
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
    </aside>
  );
}
