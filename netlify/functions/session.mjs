import { authorized,equal,session,sameOrigin } from './_private.mjs';
import { json } from './_archive.mjs';
export default async request=>{
  if(request.method==='GET')return json({authenticated:authorized(request),configured:!!process.env.BET_ACCESS_TOKEN});
  if(!sameOrigin(request))return json({error:'Forbidden'},403);
  if(request.method==='DELETE')return new Response(null,{status:204,headers:{'set-cookie':'football_session=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0','cache-control':'no-store'}});
  if(request.method!=='POST')return json({error:'POST required'},405);
  if(!process.env.BET_ACCESS_TOKEN)return json({error:'Private bets are not configured'},503);
  try{const body=await request.text();if(body.length>1024)return json({error:'Invalid access key'},400);
    if(!equal(JSON.parse(body).key,process.env.BET_ACCESS_TOKEN))return json({error:'Invalid access key'},401);
    return new Response(JSON.stringify({authenticated:true}),{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':'football_session='+session()+'; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=604800'}});
  }catch{return json({error:'Invalid request'},400);}
};
export const config={path:'/api/session'};
