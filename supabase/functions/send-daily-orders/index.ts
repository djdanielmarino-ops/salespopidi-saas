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
  const body=await req.json()
  const organizationId=String(body.organization_id||'')
  const targetDate=/^\d{4}-\d{2}-\d{2}$/.test(String(body.date||''))?String(body.date):new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const admin=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [{data:member},{data:platform}]=await Promise.all([
   admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle(),
   admin.from('platform_admins').select('is_active').eq('user_id',user.id).maybeSingle(),
  ])
  const allowed=platform?.is_active||(member?.status==='active'&&['organization_owner','organization_admin','manager'].includes(member.role))
  if(!allowed)return reply(403,{success:false,error:'Sem permissão para enviar o resumo.'})
  const {data:endpoint}=await admin.from('webhook_endpoints').select('id,url,timeout_ms')
   .eq('organization_id',organizationId).eq('endpoint_key','daily_orders')
   .eq('environment','production').eq('is_active',true).maybeSingle()
  if(!endpoint)return reply(404,{success:false,error:'Webhook de pedidos diários não configurado.'})
  const {data:orders,error}=await admin.from('orders').select('id,order_number,status,delivery_type,delivery_date,delivery_time,total,customers:customer_id(full_name,phone),taps:tap_id(code),cylinders:cylinder_id(code),order_items(quantity_liters,barrel_quantity,beer_types(name),barrel_models(volume))')
   .eq('organization_id',organizationId).eq('delivery_date',targetDate).neq('status','cancelado').order('delivery_time',{ascending:true,nullsFirst:true})
  if(error)throw error
  const eventId=crypto.randomUUID()
  const payload={event_id:eventId,event_type:'orders.daily_summary',schema_version:1,organization_id:organizationId,unit_id:null,occurred_at:new Date().toISOString(),data:{date:targetDate,timezone:'America/Sao_Paulo',count:orders?.length||0,orders:orders||[]}}
  const {data:event,error:eventError}=await admin.from('integration_events').insert({organization_id:organizationId,event_id:eventId,direction:'outbound',event_type:payload.event_type,aggregate_type:'daily_orders',source:'salespopidi',status:'processing',payload}).select('id').single()
  if(eventError)throw eventError
  const startedAt=new Date().toISOString()
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),endpoint.timeout_ms)
  let response:Response
  try{response=await fetch(endpoint.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})}
  catch(fetchError){
   const message=fetchError instanceof Error?fetchError.message:'Falha de conexão.'
   await admin.from('integration_events').update({status:'failed',error_message:message}).eq('id',event.id)
   await admin.from('webhook_deliveries').insert({organization_id:organizationId,event_id:event.id,endpoint_id:endpoint.id,status:'failed',error_message:message,started_at:startedAt,finished_at:new Date().toISOString()})
   return reply(502,{success:false,error:message})
  }finally{clearTimeout(timer)}
  const excerpt=(await response.text()).slice(0,1000)
  await admin.from('webhook_deliveries').insert({organization_id:organizationId,event_id:event.id,endpoint_id:endpoint.id,status:response.ok?'delivered':'failed',response_status:response.status,response_body_excerpt:excerpt,error_message:response.ok?null:`HTTP ${response.status}`,started_at:startedAt,finished_at:new Date().toISOString()})
  await admin.from('integration_events').update({status:response.ok?'processed':'failed',processed_at:response.ok?new Date().toISOString():null,error_message:response.ok?null:`HTTP ${response.status}`}).eq('id',event.id)
  return reply(response.ok?200:502,{success:response.ok,status:response.status,event_id:eventId,count:orders?.length||0,date:targetDate})
 }catch(error){return reply(500,{success:false,error:error instanceof Error?error.message:'Erro interno.'})}
})
