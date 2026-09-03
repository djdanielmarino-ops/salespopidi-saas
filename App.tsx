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
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/customers" element={<AuthGuard><Customers /></AuthGuard>} />
          <Route path="/orders/new" element={<AuthGuard><NewOrder /></AuthGuard>} />
          <Route path="/orders" element={<AuthGuard><Orders /></AuthGuard>} />
          <Route path="/taps" element={<AuthGuard><Taps /></AuthGuard>} />
          <Route path="/barrels" element={<AuthGuard><Barrels /></AuthGuard>} />
          <Route path="/cylinders" element={<AuthGuard><Cylinders /></AuthGuard>} />
          <Route path="/inventory" element={<AuthGuard><Inventory /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
          <Route path="/financial" element={<AuthGuard><Financial /></AuthGuard>} />
          <Route path="/costs" element={<AuthGuard><Costs /></AuthGuard>} />
          <Route path="/crm" element={<AuthGuard><CRM /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
