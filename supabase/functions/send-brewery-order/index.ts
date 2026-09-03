import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization'); if(!auth)return new Response(JSON.stringify({success:false,error:'Não autenticado'}),{status:401,headers:cors});
    const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userClient.auth.getUser(); if(!user)return new Response(JSON.stringify({success:false,error:'Não autorizado'}),{status:401,headers:cors});
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); const {order_id}=await req.json();
    const {data:profile}=await admin.from('user_profiles').select('role,is_active,permissions').eq('user_id',user.id).single();
    if(!profile?.is_active||(profile.role!=='admin'&&profile.permissions?.barrels!=='manage'))return new Response(JSON.stringify({success:false,error:'Sem permissão'}),{status:403,headers:cors});
    const {data:order,error}=await admin.from('brewery_orders').select('*, brewery_order_items(*, beer_types(name,code), barrel_models(volume))').eq('id',order_id).single(); if(error)throw error;
    if(order.status!=='draft'&&order.status!=='pending_send')throw new Error('Somente rascunhos ou envios pendentes podem ser enviados.');
    const eventId=crypto.randomUUID(); const payload={event_id:eventId,event_type:'brewery_order.created',schema_version:1,occurred_at:new Date().toISOString(),order};
    await admin.from('integration_events').insert({event_id:eventId,direction:'outbound',event_type:payload.event_type,aggregate_type:'brewery_order',aggregate_id:order.id,status:'processing',payload,attempt_count:1});
    await admin.from('brewery_orders').update({status:'pending_send'}).eq('id',order.id);
    const url=Deno.env.get('BREWERY_WEBHOOK_URL'); if(!url)throw new Error('BREWERY_WEBHOOK_URL não configurada.');
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),15000);
    let response:Response; try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Secret':Deno.env.get('BREWERY_WEBHOOK_SECRET')||''},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timeout);}
    const body=await response.text();
    await admin.from('integration_events').update({status:response.ok?'processed':'failed',response_status:response.status,response_body:body.slice(0,5000),processed_at:response.ok?new Date().toISOString():null,error_message:response.ok?null:`HTTP ${response.status}`,next_retry_at:response.ok?null:new Date(Date.now()+5*60*1000).toISOString()}).eq('event_id',eventId);
    if(!response.ok)throw new Error(`Integração respondeu HTTP ${response.status}.`);
    await admin.from('brewery_orders').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',order.id);
    return new Response(JSON.stringify({success:true,event_id:eventId}),{headers:cors});
  }catch(error){return new Response(JSON.stringify({success:false,error:error instanceof Error?error.message:'Erro interno'}),{status:500,headers:cors});}
});
