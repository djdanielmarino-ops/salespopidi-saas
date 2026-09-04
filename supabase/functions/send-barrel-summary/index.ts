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
  const payload=await req.json()
  const organizationId=String(payload.organization_id||'')
  if(!organizationId||!payload.date||!Array.isArray(payload.barrels)||!payload.message)return reply(400,{success:false,error:'Resumo inválido.'})
  const admin=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [{data:member},{data:platform}]=await Promise.all([
   admin.from('organization_members').select('status').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle(),
   admin.from('platform_admins').select('is_active').eq('user_id',user.id).maybeSingle(),
  ])
  if(member?.status!=='active'&&!platform?.is_active)return reply(403,{success:false,error:'Sem acesso à empresa.'})
  const {data:endpoint}=await admin.from('webhook_endpoints').select('url,timeout_ms').eq('organization_id',organizationId)
   .eq('endpoint_key','barrels_daily_summary').eq('environment','production').eq('is_active',true).maybeSingle()
  if(!endpoint)return reply(404,{success:false,error:'Webhook de resumo de barris não configurado.'})
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),endpoint.timeout_ms)
  let response:Response
  try{response=await fetch(endpoint.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,sentBy:user.id}),signal:controller.signal})}
  finally{clearTimeout(timer)}
  if(!response.ok)return reply(502,{success:false,error:`Webhook respondeu HTTP ${response.status}.`})
  return reply(200,{success:true,status:response.status})
 }catch(error){return reply(500,{success:false,error:error instanceof Error?error.message:'Erro interno.'})}
})
