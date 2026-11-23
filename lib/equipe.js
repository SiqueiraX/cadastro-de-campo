import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const digest=value=>createHash('sha256').update(value).digest('hex');
const cookie='__Host-campo';
const lifetime=12*60*60;
function respond(data,token){
  const headers={'Cache-Control':'no-store'};
  if(token!==undefined)headers['Set-Cookie']=cookie+'='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(token?lifetime:0);
  return Response.json(data,{headers});
}
function reject(text,status){throw new Response(text,{status,headers:{'Cache-Control':'no-store'}})}
export function requireAdmin(request){
  if(!process.env.ADMIN_PASSWORD||!timingSafeEqual(Buffer.from(digest(request.headers.get('authorization')||'')),Buffer.from(digest('Bearer '+process.env.ADMIN_PASSWORD))))reject('Informe a senha administrativa.',401);
}
function sessionHash(request){
  const token=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookie+'='))?.slice(cookie.length+1);
  return /^[a-f0-9]{64}$/.test(token||'')?digest(token):null;
}
export async function currentWorker(request,sql){
  const hash=sessionHash(request);
  if(!hash)return null;
  const [person]=await sql`SELECT e.usuario,e.nome FROM campo_sessoes s JOIN campo_equipe e USING(usuario) WHERE s.token_hash=${hash} AND s.validade>now()`;
  return person||null;
}
export async function team(request,sql,action){
  if(request.method==='GET'&&action==='sessao')return respond({pessoa:await currentWorker(request,sql)});
  if(request.method!=='POST')reject('Método inválido.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)reject('Origem inválida.',403);
  if(action==='sair'){
    await sql`DELETE FROM campo_sessoes WHERE token_hash=${sessionHash(request)}`;
    return respond({},'');
  }
  if(!['criar','entrar'].includes(action))reject('Operação inválida.',404);
  if(action==='criar')requireAdmin(request);
  let body;
  try{body=await request.json()}catch{reject('Dados inválidos.',400)}
  const usuario=String(body?.usuario||'').trim().toLowerCase();
  const senha=body?.senha;
  if(!/^[a-z0-9._-]{3,40}$/.test(usuario)||typeof senha!=='string'||!senha.length||senha.length>128)reject('Confira o usuário e a senha.',400);
  if(action==='criar'){
    const nome=String(body.nome||'').trim();
    if(!nome||nome.length>100||senha.length<8)reject('Informe o nome e uma senha de pelo menos 8 caracteres.',400);
    const salt=randomBytes(16).toString('hex');
    const key=(await derive(senha,salt,64)).toString('hex');
    const rows=await sql`INSERT INTO campo_equipe(usuario,nome,salt,senha_hash) VALUES(${usuario},${nome},${salt},${key}) ON CONFLICT DO NOTHING RETURNING usuario`;
    if(!rows.length)reject('Este usuário já existe.',409);
    return respond({usuario,nome});
  }
  const [person]=await sql`SELECT usuario,nome,salt,senha_hash FROM campo_equipe WHERE usuario=${usuario}`;
  const key=await derive(senha,person?.salt||'campo-verificacao',64);
  if(!person||!timingSafeEqual(key,Buffer.from(person.senha_hash,'hex')))reject('Usuário ou senha incorretos.',401);
  const token=randomBytes(32).toString('hex');
  await sql`DELETE FROM campo_sessoes WHERE validade<=now()`;
  await sql`INSERT INTO campo_sessoes(token_hash,usuario,validade) VALUES(${digest(token)},${usuario},now()+interval '12 hours')`;
  return respond({pessoa:{usuario,nome:person.nome}},token);
}
