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
  name: "get_order",
  title: "Detalhes do pedido",
  description: "Retorna o pedido completo (cliente, itens, pagamentos, chopeira, cilindro) pelo `order_number`.",
  inputSchema: {
    order_number: z.number().int().positive().describe("Número do pedido (ex.: 102)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const client = sb(ctx);
    const { data: order, error } = await client
      .from("orders")
      .select("*, customers(*), taps(*), cylinders(*)")
      .eq("order_number", order_number)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!order) return { content: [{ type: "text", text: "Pedido não encontrado" }], isError: true };

    const [{ data: items }, { data: payments }] = await Promise.all([
      client.from("order_items").select("*, beer_types(name, code), barrel_models(volume)").eq("order_id", order.id),
      client.from("payments").select("*").eq("order_id", order.id),
    ]);

    const result = { ...order, items: items ?? [], payments: payments ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { order: result },
    };
  },
});
