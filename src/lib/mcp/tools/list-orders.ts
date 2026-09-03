import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_orders",
  title: "Listar pedidos",
  description:
    "Lista pedidos do ChoppControl, opcionalmente filtrados por data de entrega (YYYY-MM-DD) e/ou status. Retorna até `limit` pedidos (padrão 20).",
  inputSchema: {
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data de entrega no formato YYYY-MM-DD."),
    status: z.enum(["agendado", "em_andamento", "finalizado", "cancelado"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ delivery_date, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    let q = sb(ctx)
      .from("orders")
      .select("id, order_number, delivery_date, delivery_time, status, total, delivery_type, customers(full_name, phone, company_name, person_type)")
      .order("delivery_date", { ascending: true })
      .order("delivery_time", { ascending: true })
      .limit(limit ?? 20);
    if (delivery_date) q = q.eq("delivery_date", delivery_date);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
