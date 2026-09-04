import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'}
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors})

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply(405,{success:false,error:'Método não permitido.'})
 try{
  const auth=req.headers.get('Authorization')||''
  const base=Deno.env.get('SUPABASE_URL')!
  const userDb=createClient(base,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
  const {data:{user}}=await userDb.auth.getUser()
  if(!user)return reply(401,{success:false,error:'Sessão inválida.'})
  const admin=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {order_id:orderId}=await req.json()
  const {data:order,error}=await admin.from('brewery_orders')
   .select('*, brewery_order_items(*, beer_types(name,code), barrel_models(volume))').eq('id',orderId).single()
  if(error)throw error
  const [{data:member},{data:platform}]=await Promise.all([
   admin.from('organization_members').select('role,status,permissions').eq('organization_id',order.organization_id).eq('user_id',user.id).maybeSingle(),
   admin.from('platform_admins').select('is_active').eq('user_id',user.id).maybeSingle(),
  ])
  const allowed=platform?.is_active||(member?.status==='active'&&(['organization_owner','organization_admin','manager'].includes(member.role)||member.permissions?.purchases==='manage'))
  if(!allowed)return reply(403,{success:false,error:'Sem permissão para enviar este pedido.'})
  if(!['draft','pending_send'].includes(order.status))return reply(400,{success:false,error:'Somente rascunhos ou envios pendentes podem ser enviados.'})
  const {data:endpoint}=await admin.from('webhook_endpoints').select('id,url,timeout_ms')
   .eq('organization_id',order.organization_id).eq('endpoint_key','brewery_orders_send')
   .eq('environment','production').eq('is_active',true).maybeSingle()
  if(!endpoint)return reply(404,{success:false,error:'Webhook de pedidos para cervejaria não configurado.'})

  const eventId=crypto.randomUUID()
  const payload={event_id:eventId,event_type:'brewery_order.created',schema_version:1,occurred_at:new Date().toISOString(),organization_id:order.organization_id,order}
  const {data:event,error:eventError}=await admin.from('integration_events').insert({
   organization_id:order.organization_id,event_id:eventId,direction:'outbound',event_type:payload.event_type,
   aggregate_type:'brewery_order',aggregate_id:order.id,source:'salespopidi',status:'processing',payload,
  }).select('id').single()
  if(eventError)throw eventError
  await admin.from('brewery_orders').update({status:'pending_send'}).eq('id',order.id).eq('organization_id',order.organization_id)
  const startedAt=new Date().toISOString()
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),endpoint.timeout_ms)
  let response:Response
  try{response=await fetch(endpoint.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})}
  catch(fetchError){
   const message=fetchError instanceof Error?fetchError.message:'Falha de conexão.'
   await admin.from('integration_events').update({status:'failed',error_message:message}).eq('id',event.id)
   await admin.from('webhook_deliveries').insert({organization_id:order.organization_id,event_id:event.id,endpoint_id:endpoint.id,status:'failed',error_message:message,started_at:startedAt,finished_at:new Date().toISOString()})
   return reply(502,{success:false,error:message})
  }finally{clearTimeout(timer)}
  const excerpt=(await response.text()).slice(0,1000)
  await admin.from('webhook_deliveries').insert({organization_id:order.organization_id,event_id:event.id,endpoint_id:endpoint.id,status:response.ok?'delivered':'failed',response_status:response.status,response_body_excerpt:excerpt,error_message:response.ok?null:`HTTP ${response.status}`,started_at:startedAt,finished_at:new Date().toISOString()})
  await admin.from('integration_events').update({status:response.ok?'processed':'failed',processed_at:response.ok?new Date().toISOString():null,error_message:response.ok?null:`HTTP ${response.status}`}).eq('id',event.id)
  if(!response.ok)return reply(502,{success:false,error:`Integração respondeu HTTP ${response.status}.`})
  await admin.from('brewery_orders').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',order.id).eq('organization_id',order.organization_id)
  return reply(200,{success:true,event_id:eventId})
 }catch(error){return reply(500,{success:false,error:error instanceof Error?error.message:'Erro interno.'})}
})
