import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const jsonHeaders={'Content-Type':'application/json'};
const hex=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const secureEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let value=0;for(let i=0;i<a.length;i++)value|=a.charCodeAt(i)^b.charCodeAt(i);return value===0;};
Deno.serve(async(req)=>{
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Método não permitido'}),{status:405,headers:jsonHeaders});
  try{
    const raw=await req.text(); const signature=(req.headers.get('x-webhook-signature')||'').replace(/^sha256=/,'').toLowerCase(); const secret=Deno.env.get('BREWERY_WEBHOOK_SECRET');
    if(!secret)return new Response(JSON.stringify({error:'Integração não configurada'}),{status:503,headers:jsonHeaders});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); const expected=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
    if(!signature||!secureEqual(signature,expected))return new Response(JSON.stringify({error:'Assinatura inválida'}),{status:401,headers:jsonHeaders});
    const payload=JSON.parse(raw); if(!payload.event_id||!payload.event_type)return new Response(JSON.stringify({error:'event_id e event_type são obrigatórios'}),{status:400,headers:jsonHeaders});
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:existing}=await db.from('integration_events').select('status').eq('event_id',payload.event_id).maybeSingle(); if(existing)return new Response(JSON.stringify({success:true,duplicate:true,status:existing.status}),{headers:jsonHeaders});
    const localId=payload.order_id||payload.order?.id||null; const externalId=payload.external_order_id||payload.order?.external_order_id||null;
    let query=db.from('brewery_orders').select('id,status'); query=localId?query.eq('id',localId):query.eq('external_order_id',externalId||'__missing__'); const {data:order}=await query.maybeSingle();
    await db.from('integration_events').insert({event_id:payload.event_id,direction:'inbound',event_type:payload.event_type,aggregate_type:'brewery_order',aggregate_id:order?.id||null,status:order?'processing':'unmatched',payload});
    if(!order)return new Response(JSON.stringify({success:true,matched:false}),{headers:jsonHeaders});
    const statusMap:Record<string,string>={'brewery_order.accepted':'acknowledged','brewery_order.confirmed':'confirmed','brewery_order.released':'released','brewery_order.invoice_issued':'released','brewery_order.shipped':'in_transit','brewery_order.rejected':'rejected','brewery_order.cancelled':'cancelled'}; const next=statusMap[payload.event_type];
    if(!next){await db.from('integration_events').update({status:'unmatched',error_message:'Tipo de evento não reconhecido'}).eq('event_id',payload.event_id);return new Response(JSON.stringify({success:true,matched:true,processed:false}),{headers:jsonHeaders});}
    const changes:Record<string,unknown>={status:next}; if(externalId)changes.external_order_id=externalId; if(payload.invoice?.number)changes.invoice_number=payload.invoice.number;if(payload.invoice?.key)changes.invoice_key=payload.invoice.key;if(payload.invoice?.issued_at)changes.invoice_issued_at=payload.invoice.issued_at;if(payload.expected_delivery_date)changes.expected_delivery_date=payload.expected_delivery_date;
    const {error}=await db.from('brewery_orders').update(changes).eq('id',order.id);if(error)throw error;
    if(Array.isArray(payload.items)){for(const item of payload.items){if(item.item_id&&Number.isFinite(Number(item.quantity_released)))await db.from('brewery_order_items').update({quantity_released:Number(item.quantity_released)}).eq('id',item.item_id).eq('brewery_order_id',order.id);}}
    await db.from('integration_events').update({status:'processed',processed_at:new Date().toISOString()}).eq('event_id',payload.event_id);
    return new Response(JSON.stringify({success:true,matched:true,processed:true}),{headers:jsonHeaders});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'Erro interno'}),{status:500,headers:jsonHeaders});}
});
