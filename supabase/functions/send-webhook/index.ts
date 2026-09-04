import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'}
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
  const payload=await req.json()
  const admin=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:order}=await admin.from('orders').select('id,organization_id').eq('id',String(payload.order_id||'')).maybeSingle()
  if(!order)return reply(404,{success:false,error:'Pedido não encontrado.'})
  const [{data:member},{data:platform}]=await Promise.all([
   admin.from('organization_members').select('status').eq('organization_id',order.organization_id).eq('user_id',user.id).maybeSingle(),
   admin.from('platform_admins').select('is_active').eq('user_id',user.id).maybeSingle(),
  ])
  if(member?.status!=='active'&&!platform?.is_active)return reply(403,{success:false,error:'Sem acesso à empresa.'})
  const {data:endpoint}=await admin.from('webhook_endpoints').select('id,url,timeout_ms')
   .eq('organization_id',order.organization_id).eq('endpoint_key','orders_automation')
   .eq('environment','production').eq('is_active',true).maybeSingle()
  if(!endpoint)return reply(404,{success:false,error:'Webhook de pedidos não configurado para esta empresa.'})
  const eventId=crypto.randomUUID()
  const eventType=payload.action==='entrada'?'order.completed':'order.dispatched'
  const enriched={...payload,event_id:eventId,event_type:eventType,organization_id:order.organization_id}
  const {data:event,error:eventError}=await admin.from('integration_events').insert({
   organization_id:order.organization_id,event_id:eventId,direction:'outbound',event_type:eventType,
   aggregate_type:'order',aggregate_id:order.id,source:'salespopidi',status:'processing',payload:enriched,
  }).select('id').single()
  if(eventError)throw eventError
  const startedAt=new Date().toISOString()
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),endpoint.timeout_ms)
  let response:Response
  try{response=await fetch(endpoint.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(enriched),signal:controller.signal})}
  catch(error){
   const message=error instanceof Error?error.message:'Falha de conexão.'
   await admin.from('integration_events').update({status:'failed',error_message:message}).eq('id',event.id)
   await admin.from('webhook_deliveries').insert({organization_id:order.organization_id,event_id:event.id,endpoint_id:endpoint.id,status:'failed',error_message:message,started_at:startedAt,finished_at:new Date().toISOString()})
   return reply(502,{success:false,error:message})
  }finally{clearTimeout(timer)}
  const excerpt=(await response.text()).slice(0,1000)
  await admin.from('webhook_deliveries').insert({organization_id:order.organization_id,event_id:event.id,endpoint_id:endpoint.id,status:response.ok?'delivered':'failed',response_status:response.status,response_body_excerpt:excerpt,error_message:response.ok?null:`HTTP ${response.status}`,started_at:startedAt,finished_at:new Date().toISOString()})
  await admin.from('integration_events').update({status:response.ok?'processed':'failed',processed_at:response.ok?new Date().toISOString():null,error_message:response.ok?null:`HTTP ${response.status}`}).eq('id',event.id)
  return reply(response.ok?200:502,{success:response.ok,status:response.status,event_id:eventId})
 }catch(error){return reply(500,{success:false,error:error instanceof Error?error.message:'Erro interno.'})}
})
