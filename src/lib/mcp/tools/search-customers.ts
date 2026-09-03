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
  name: "search_customers",
  title: "Buscar clientes",
  description: "Busca clientes por nome, razão social, CPF, CNPJ, telefone ou email. Retorna até `limit` (padrão 20).",
  inputSchema: {
    query: z.string().trim().min(1).describe("Texto a buscar."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const like = `%${query}%`;
    const { data, error } = await sb(ctx)
      .from("customers")
      .select("id, full_name, company_name, trade_name, person_type, cpf, cnpj, phone, email, city, state")
      .or(
        `full_name.ilike.${like},company_name.ilike.${like},trade_name.ilike.${like},cpf.ilike.${like},cnpj.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
      )
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { customers: data ?? [] },
    };
  },
});
