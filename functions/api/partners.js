const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const clean = (v, max=500) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const ADMIN_KEY_SHA256 = '2e76eae88aeb0fd2e4915852c29024510190a9ed38c121e497cbd9808c9788a3';

async function sha256Hex(value){
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function isAdmin(request, env){
  const supplied = request.headers.get('X-Admin-Key') || '';
  if (!supplied) return false;
  if (env.ADMIN_KEY) return supplied === env.ADMIN_KEY;
  return (await sha256Hex(supplied)) === ADMIN_KEY_SHA256;
}

export async function onRequestPost(context){
  const {request, env} = context;
  if(!env.DB) return json({error:'Partner database is not configured.'},500);
  let body;
  try { body = await request.json(); } catch { return json({error:'Invalid form submission.'},400); }
  const item = {
    full_name: clean(body.full_name,120), email: clean(body.email,180).toLowerCase(), phone: clean(body.phone,60),
    organization: clean(body.organization,180), city: clean(body.city,120), country: clean(body.country,120),
    interest: clean(body.interest,180), message: clean(body.message,1500), consent: body.consent ? 1 : 0
  };
  if(!item.full_name || !item.email || !item.country || !item.interest || !item.consent) return json({error:'Please complete all required fields.'},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return json({error:'Please provide a valid email address.'},400);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO partner_submissions (full_name,email,phone,organization,city,country,interest,message,consent,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(item.full_name,item.email,item.phone,item.organization,item.city,item.country,item.interest,item.message,item.consent,now).run();
  return json({ok:true},201);
}

export async function onRequestGet(context){
  const {request, env} = context;
  if(!(await isAdmin(request,env))) return json({error:'Unauthorized.'},401);
  if(!env.DB) return json({error:'Partner database is not configured.'},500);
  const {results=[]} = await env.DB.prepare(`SELECT id,full_name,email,phone,organization,city,country,interest,message,submitted_at FROM partner_submissions ORDER BY id DESC LIMIT 1000`).all();
  return json({items:results});
}

export async function onRequestDelete(context){
  const {request, env} = context;
  if(!(await isAdmin(request,env))) return json({error:'Unauthorized.'},401);
  if(!env.DB) return json({error:'Partner database is not configured.'},500);
  await env.DB.prepare('DELETE FROM partner_submissions').run();
  return json({ok:true});
}
