const cases = new Set(['chapter2','chapter3','chapter4']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validToken = /^[a-f0-9]{64}$/;
const now = () => Date.now();
async function hash(text) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2,'0')).join(''); }
async function authorised(request, env) {
  const supplied = request.headers.get('authorization') || '';
  if (!env.ADMIN_TOKEN || supplied.length > 200) return false;
  const a = await hash(supplied), b = await hash('Bearer ' + env.ADMIN_TOKEN);
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff === 0;
}
function failure(status, message) { throw Object.assign(new Error(message), {status}); }
async function body(request) {
  if (!(request.headers.get('content-type')||'').startsWith('application/json')) failure(415,'JSON required.');
  if (!request.body) failure(400,'Missing request body.');
  const reader=request.body.getReader(); let size=0; const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();failure(413,'Request too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  try { const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')failure(400,'Invalid JSON.');return value; } catch { failure(400,'Invalid JSON.'); }
}
async function route(request, env) {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if (!env.DB || !env.ADMIN_TOKEN) failure(503,'Live progress is not configured.');
  if(path.startsWith('/api/admin/') && !await authorised(request,env)) failure(401,'Instructor sign-in required.');
  let m=path.match(/^\/api\/cases\/(chapter[234])\/active$/);
  if(method==='GET'&&m){
    const run=await env.DB.prepare('SELECT id,case_id,label,expires_at FROM runs WHERE case_id=? AND closed_at IS NULL AND expires_at>?').bind(m[1],now()).first();
    return {run:run||null};
  }
  if(method==='POST'&&path==='/api/events'){
    const b=await body(request);
    if(!uuid.test(b.run||'')||!validToken.test(b.token||'')||!Number.isInteger(b.gate)||b.gate<0||b.gate>4)failure(400,'Invalid progress event.');
    const tokenHash=await hash(b.token), mask=b.gate===0?0:1<<(b.gate-1), time=now();
    const result=await env.DB.batch([
      env.DB.prepare('INSERT INTO participants(run_id,token_hash,gates) SELECT id,?,? FROM runs WHERE id=? AND closed_at IS NULL AND expires_at>? ON CONFLICT(run_id,token_hash) DO UPDATE SET gates=participants.gates | excluded.gates WHERE (participants.gates | excluded.gates) != participants.gates').bind(tokenHash,mask,b.run,time),
      env.DB.prepare('SELECT id FROM runs WHERE id=? AND closed_at IS NULL AND expires_at>?').bind(b.run,time)
    ]);
    if(!result[1].results.length)failure(409,'This teaching session has ended.');
    return {accepted:true};
  }
  if(method==='GET'&&path==='/api/admin/overview'){
    const rows=await env.DB.prepare(`SELECT r.id,r.case_id,r.label,r.created_at,r.expires_at,r.closed_at,
      COUNT(p.token_hash) AS started,
      COALESCE(SUM((p.gates & 1) != 0),0) AS gate1,
      COALESCE(SUM((p.gates & 2) != 0),0) AS gate2,
      COALESCE(SUM((p.gates & 4) != 0),0) AS gate3,
      COALESCE(SUM((p.gates & 8) != 0),0) AS gate4,
      COALESCE(SUM(p.gates=15),0) AS finished
      FROM runs r LEFT JOIN participants p ON p.run_id=r.id
      WHERE r.id=(SELECT id FROM runs r2 WHERE r2.case_id=r.case_id ORDER BY created_at DESC,id DESC LIMIT 1)
      GROUP BY r.id`).all();
    return {asOf:now(),runs:rows.results};
  }
  if(method==='POST'&&path==='/api/admin/runs'){
    const b=await body(request);if(!cases.has(b.case)||!uuid.test(b.id||'')||typeof b.label!=='string'||b.label.trim().length<1||b.label.length>80)failure(400,'Choose a case and a short session label.');
    const time=now();
    const existing=await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(b.id).first();
    if(existing){if(existing.case_id!==b.case)failure(409,'Session ID already in use.');return {run:existing};}
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE runs SET closed_at=expires_at WHERE case_id=? AND closed_at IS NULL AND expires_at<=?').bind(b.case,time),
        env.DB.prepare('INSERT INTO runs(id,case_id,label,created_at,expires_at) VALUES (?,?,?,?,?)').bind(b.id,b.case,b.label.trim(),time,time+12*3600000)
      ]);
    } catch { failure(409,'An active session already exists. Refresh the overview before starting another.'); }
    return {run:await env.DB.prepare('SELECT * FROM runs WHERE id=?').bind(b.id).first()};
  }
  m=path.match(/^\/api\/admin\/runs\/([0-9a-f-]+)\/close$/i);
  if(method==='POST'&&m){if(!uuid.test(m[1]))failure(400,'Invalid session.');await env.DB.prepare('UPDATE runs SET closed_at=COALESCE(closed_at,?) WHERE id=?').bind(now(),m[1]).run();return {closed:true};}
  failure(404,'Not found.');
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('origin');const allowed=(env.ALLOWED_ORIGINS||'https://ffm777.github.io').split(',').map(s=>s.trim());
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin&&!allowed.includes(origin))return new Response(JSON.stringify({error:'Origin not allowed.'}),{status:403,headers});
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}});
    try{return new Response(JSON.stringify(await route(request,env)),{headers});}
    catch(e){return new Response(JSON.stringify({error:e.status?e.message:'Live progress is temporarily unavailable.'}),{status:e.status||503,headers});}
  },
  async scheduled(_event,env){await env.DB.prepare('DELETE FROM runs WHERE created_at<?').bind(now()-30*86400000).run();}
};
