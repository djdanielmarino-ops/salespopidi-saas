import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "inventory_summary",
  title: "Resumo do estoque",
  description: "Retorna resumo de chopeiras, barris e cilindros por status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const client = sb(ctx);
    const [taps, barrels, cylinders] = await Promise.all([
      client.from("taps").select("status, voltage, code, tap_types(name)"),
      client.from("barrel_inventory").select("status, quantity, barrel_models(volume), beer_types(name)"),
      client.from("cylinders").select("status, code"),
    ]);
    const err = taps.error || barrels.error || cylinders.error;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };
    const summary = {
      taps: taps.data ?? [],
      barrels: barrels.data ?? [],
      cylinders: cylinders.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
