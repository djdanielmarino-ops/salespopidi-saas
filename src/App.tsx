import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import NewOrder from "./pages/NewOrder";
import Orders from "./pages/Orders";
import Taps from "./pages/Taps";
import Barrels from "./pages/Barrels";
import Cylinders from "./pages/Cylinders";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";
import Financial from "./pages/Financial";
import Costs from "./pages/Costs";
import CRM from "./pages/CRM";
import Products from "./pages/Products";
import BreweryOrders from "./pages/BreweryOrders";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";

import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { TenantProvider } from "@/contexts/TenantContext";
import { TenantGuard } from "@/components/auth/TenantGuard";
import { PlatformGuard } from "@/components/auth/PlatformGuard";
import Master from "./pages/Master";
import MasterIntegrations from "./pages/MasterIntegrations";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: ReactNode }) => (
  <AuthGuard>
    <TenantGuard>{children}</TenantGuard>
  </AuthGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TenantProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/master" element={<AuthGuard><PlatformGuard><Master /></PlatformGuard></AuthGuard>} />
          <Route path="/master/integrations" element={<AuthGuard><PlatformGuard><MasterIntegrations /></PlatformGuard></AuthGuard>} />
          <Route path="/" element={<Protected><PermissionGuard module="dashboard"><Dashboard /></PermissionGuard></Protected>} />
          <Route path="/customers" element={<Protected><PermissionGuard module="customers"><Customers /></PermissionGuard></Protected>} />
          <Route path="/orders/new" element={<Protected><PermissionGuard module="orders" action="manage"><NewOrder /></PermissionGuard></Protected>} />
          <Route path="/orders" element={<Protected><PermissionGuard module="orders"><Orders /></PermissionGuard></Protected>} />
          <Route path="/taps" element={<Protected><PermissionGuard module="taps"><Taps /></PermissionGuard></Protected>} />
          <Route path="/barrels" element={<Protected><PermissionGuard module="barrels"><Barrels /></PermissionGuard></Protected>} />
          <Route path="/brewery-orders" element={<Protected><PermissionGuard module="purchases"><BreweryOrders /></PermissionGuard></Protected>} />
          <Route path="/cylinders" element={<Protected><PermissionGuard module="cylinders"><Cylinders /></PermissionGuard></Protected>} />
          <Route path="/inventory" element={<Protected><PermissionGuard module="inventory"><Inventory /></PermissionGuard></Protected>} />
          <Route path="/products" element={<Protected><PermissionGuard module="inventory"><Products /></PermissionGuard></Protected>} />
          <Route path="/settings" element={<Protected><PermissionGuard module="settings"><Settings /></PermissionGuard></Protected>} />
          <Route path="/financial" element={<Protected><PermissionGuard module="financial"><Financial /></PermissionGuard></Protected>} />
          <Route path="/costs" element={<Protected><PermissionGuard module="costs"><Costs /></PermissionGuard></Protected>} />
          <Route path="/crm" element={<Protected><PermissionGuard module="crm"><CRM /></PermissionGuard></Protected>} />
          <Route path="/unauthorized" element={<Protected><Unauthorized /></Protected>} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </TenantProvider>
  </QueryClientProvider>
);

export default App;
