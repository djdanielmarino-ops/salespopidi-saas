import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/" element={<AuthGuard><PermissionGuard module="dashboard"><Dashboard /></PermissionGuard></AuthGuard>} />
          <Route path="/customers" element={<AuthGuard><PermissionGuard module="customers"><Customers /></PermissionGuard></AuthGuard>} />
          <Route path="/orders/new" element={<AuthGuard><PermissionGuard module="orders" action="manage"><NewOrder /></PermissionGuard></AuthGuard>} />
          <Route path="/orders" element={<AuthGuard><PermissionGuard module="orders"><Orders /></PermissionGuard></AuthGuard>} />
          <Route path="/taps" element={<AuthGuard><PermissionGuard module="taps"><Taps /></PermissionGuard></AuthGuard>} />
          <Route path="/barrels" element={<AuthGuard><PermissionGuard module="barrels"><Barrels /></PermissionGuard></AuthGuard>} />
          <Route path="/brewery-orders" element={<AuthGuard><PermissionGuard module="barrels"><BreweryOrders /></PermissionGuard></AuthGuard>} />
          <Route path="/cylinders" element={<AuthGuard><PermissionGuard module="cylinders"><Cylinders /></PermissionGuard></AuthGuard>} />
          <Route path="/inventory" element={<AuthGuard><PermissionGuard module="inventory"><Inventory /></PermissionGuard></AuthGuard>} />
          <Route path="/products" element={<AuthGuard><PermissionGuard module="inventory"><Products /></PermissionGuard></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><PermissionGuard module="settings"><Settings /></PermissionGuard></AuthGuard>} />
          <Route path="/financial" element={<AuthGuard><PermissionGuard module="financial"><Financial /></PermissionGuard></AuthGuard>} />
          <Route path="/costs" element={<AuthGuard><PermissionGuard module="costs"><Costs /></PermissionGuard></AuthGuard>} />
          <Route path="/crm" element={<AuthGuard><PermissionGuard module="crm"><CRM /></PermissionGuard></AuthGuard>} />
          <Route path="/unauthorized" element={<AuthGuard><Unauthorized /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
