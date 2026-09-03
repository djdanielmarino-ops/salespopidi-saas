import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { personal, order, invoice, consent, uid } = await req.json();

    if (!personal?.nome || !personal?.whatsapp) {
      return new Response(
        JSON.stringify({ error: "Nome e WhatsApp são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Parse birth date DD/MM/YYYY → YYYY-MM-DD ---
    const parseDate = (value?: string | null) => {
      if (!value) return null;
      if (value.includes("-")) return value;
      const parts = value.split("/");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return value;
    };

    const normalizeText = (value?: string | null) =>
      (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const normalizeVoltage = (value?: string | null) => {
      const normalized = normalizeText(value).replace(/\s/g, "");
      if (normalized.includes("110")) return "110V";
      if (normalized.includes("220")) return "220V";
      if (normalized.includes("bivolt")) return "Bivolt";
      return value || null;
    };

    const birthDateISO = parseDate(personal.nascimento);

    // --- Determine person type ---
    const personType = personal.cnpj ? "PJ" : "PF";

    // --- Customer data (mapped fields) ---
    const customerData: Record<string, any> = {
      full_name: personal.razaoSocial || personal.nome,
      birth_date: birthDateISO,
      cpf: personal.cpf || null,
      rg: personal.rg || null,
      phone: personal.whatsapp,
      email: personal.email || null,
      zip_code: personal.cep || null,
      street: personal.endereco || null,
      number: personal.numero || null,
      complement: personal.complemento || null,
      neighborhood: personal.bairro || null,
      city: personal.cidade || null,
      state: personal.uf || null,
      person_type: personType,
      cnpj: personal.cnpj || null,
      company_name: personal.razaoSocial || null,
      trade_name: personal.nomeFantasia || null,
      state_registration: personal.inscricaoEstadual || null,
      contact_name: personal.nomeResponsavel || null,
      contact_phone: personal.telefoneResponsavel || null,
      contact_email: personal.emailResponsavel || null,
    };

    let customerId: string;
    const lookupField = personType === "PJ" && personal.cnpj ? "cnpj" : "cpf";
    const lookupValue = personType === "PJ" ? personal.cnpj : personal.cpf;

    if (lookupValue) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq(lookupField, lookupValue)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
        await supabase.from("customers").update(customerData).eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers").insert(customerData).select("id").single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers").insert(customerData).select("id").single();
      if (custErr) throw custErr;
      customerId = newCust.id;
    }

    // --- Build notes ---
    const notesParts: string[] = [];
    if (order.nomeResponsavel) notesParts.push(`Responsável: ${order.nomeResponsavel}`);
    if (order.telResponsavel) notesParts.push(`Tel responsável: ${order.telResponsavel}`);
    if (invoice?.desejaNota) {
      notesParts.push("Deseja nota fiscal");
      if (invoice.cnpjCpf) notesParts.push(`CNPJ/CPF nota: ${invoice.cnpjCpf}`);
      if (invoice.razaoSocial) notesParts.push(`Razão social: ${invoice.razaoSocial}`);
      if (invoice.ie) notesParts.push(`IE: ${invoice.ie}`);
      if (invoice.im) notesParts.push(`IM: ${invoice.im}`);
      if (invoice.usarDadosCadastro !== undefined) {
        notesParts.push(`Usar dados do cadastro na nota: ${invoice.usarDadosCadastro ? "sim" : "nao"}`);
      }
    }
    if (order.itens?.length) {
      const chopeiras = order.itens
        .filter((i: any) => i.chopeira)
        .map((i: any) => `${i.chopeira}${i.voltagem ? ` ${i.voltagem}` : ""}`)
        .join(", ");
      if (chopeiras) notesParts.push(`Chopeira(s): ${chopeiras}`);
    }
    if (consent?.accepted_terms) {
      notesParts.push(`Termos aceitos: ${consent.terms_version || "versao nao informada"}`);
      if (consent.accepted_at) notesParts.push(`Aceite em: ${consent.accepted_at}`);
      if (consent.ip_address) notesParts.push(`IP aceite: ${consent.ip_address}`);
    }
    if (uid) notesParts.push(`UID formulario: ${uid}`);

    // --- Map delivery type ---
    const deliveryType = order.tipoEntrega === "entrega" ? "entrega" : "retirada";

    // --- Parse delivery and return dates ---
    const deliveryDate = parseDate(order.dataRetirada);
    const expectedReturnDate = parseDate(order.dataDevolucao || order.dataRetorno || order.dataRetirada);

    // --- Resolve requested tap by type/voltage when possible ---
    let tapId: string | null = null;
    const firstTapRequest = order.itens?.find((item: any) => item.chopeira || item.voltagem);
    if (firstTapRequest && deliveryDate) {
      const requestedType = normalizeText(firstTapRequest.chopeira);
      const requestedVoltage = normalizeVoltage(firstTapRequest.voltagem);

      const [{ data: taps }, { data: reservations }] = await Promise.all([
        supabase
          .from("taps")
          .select("id, status, voltage, tap_types(name)")
          .neq("status", "manutencao"),
        supabase
          .from("orders")
          .select("tap_id, delivery_date, expected_return_date, status")
          .not("tap_id", "is", null)
          .in("status", ["agendado", "em_andamento"]),
      ]);

      const requestedStart = new Date(`${deliveryDate}T00:00:00`);
      const requestedEnd = new Date(`${expectedReturnDate || deliveryDate}T00:00:00`);
      const reservedTapIds = new Set(
        (reservations || [])
          .filter((reservation: any) => {
            const reservedStart = new Date(`${reservation.delivery_date}T00:00:00`);
            const reservedEnd = new Date(`${reservation.expected_return_date || reservation.delivery_date}T00:00:00`);
            return requestedStart <= reservedEnd && reservedStart <= requestedEnd;
          })
          .map((reservation: any) => reservation.tap_id)
      );

      const matchingTap = (taps || []).find((tap: any) => {
        const typeName = normalizeText(tap.tap_types?.name);
        const voltageMatches = !requestedVoltage || tap.voltage === requestedVoltage || tap.voltage === "Bivolt";
        const typeMatches = !requestedType || typeName.includes(requestedType) || requestedType.includes(typeName);
        return voltageMatches && typeMatches && !reservedTapIds.has(tap.id);
      });

      tapId = matchingTap?.id || null;
      if (!tapId) {
        notesParts.push(`Atencao: chopeira solicitada nao vinculada automaticamente (${firstTapRequest.chopeira || "-"} ${firstTapRequest.voltagem || "-"})`);
      }
    }

    // --- Insert order ---
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        delivery_date: deliveryDate,
        delivery_type: deliveryType,
        delivery_time: order.horarioEntrega || null,
        tap_id: tapId,
        expected_return_date: expectedReturnDate,
        delivery_address_street: order.enderecoEntrega || null,
        delivery_address_number: order.numeroEntrega || null,
        delivery_address_complement: order.complementoEntrega || null,
        delivery_address_neighborhood: order.bairroEntrega || null,
        delivery_address_city: order.cidadeEntrega || null,
        delivery_address_state: order.ufEntrega || null,
        delivery_address_zip_code: order.cepEntrega || null,
        status: "agendado",
        subtotal: 0,
        delivery_fee: 0,
        discount: 0,
        total: 0,
        notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    // --- Insert order items ---
    if (order.itens?.length) {
      const [{ data: beerTypes }, { data: barrelModels }] = await Promise.all([
        supabase.from("beer_types").select("id, name"),
        supabase.from("barrel_models").select("id, volume"),
      ]);

      const items = order.itens.map((item: any) => {
        const beerType = beerTypes?.find(
          (bt: any) => bt.name.toLowerCase() === (item.tipo || "").toLowerCase()
        );
        const volumeNum = parseInt(String(item.volume).replace(/\D/g, ""), 10) || 0;
        const barrelModel = barrelModels?.find((bm: any) => bm.volume === volumeNum);
        const qty = item.quantidade || 1;

        return {
          order_id: newOrder.id,
          beer_type_id: beerType?.id || beerTypes?.[0]?.id,
          barrel_model_id: barrelModel?.id || null,
          barrel_quantity: qty,
          sold_barrel_quantity: qty,
          consigned_barrel_quantity: 0,
          quantity_liters: volumeNum * qty,
          unit_price: 0,
          total_price: 0,
        };
      });

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;
    }

    return new Response(
      JSON.stringify({ order_id: newOrder.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("submit-order error:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao salvar pedido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
