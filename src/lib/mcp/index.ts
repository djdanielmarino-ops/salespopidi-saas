import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrders from "./tools/list-orders";
import getOrder from "./tools/get-order";
import searchCustomers from "./tools/search-customers";
import inventorySummary from "./tools/inventory-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "choppcontrol-mcp",
  title: "ChoppControl (Popidi Chopp)",
  version: "0.1.0",
  instructions:
    "Ferramentas do ChoppControl (Popidi Chopp): consulta de pedidos, clientes e estoque de chopeiras/barris/cilindros. Todas as ferramentas operam como o usuário autenticado e respeitam as permissões (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrders, getOrder, searchCustomers, inventorySummary],
});
