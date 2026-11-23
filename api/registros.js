import { neon } from '@neondatabase/serverless';
import { currentWorker, requireAdmin, team } from '../lib/equipe.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const privateHeaders = {'Cache-Control':'private, no-store'};
function fail(message, status=400) {
  throw new Response(message,{status,headers:privateHeaders});
}
function field(form,key,required=true,maxLength=180) {
  const value=form.get(key)??'';
  if(typeof value!=='string'||value.length>maxLength||(required&&!value.trim())) fail('Confira o campo '+key+'.');
  return value.trim();
}
async function save(request,sql) {
  if(request.headers.get('origin')!==new URL(request.url).origin) fail('Origem inválida.',403);
  const autor=await currentWorker(request,sql);
  if(!autor)fail('Entre com sua conta de campo para enviar.',401);
  let form;
  try { form=await request.formData(); } catch { fail('Formulário inválido.'); }
  const id=field(form,'id');
  if(!uuid.test(id)) fail('Identificador inválido.');
  const row={id,autor,observacao:field(form,'observacao',false,2000),data:Date.now(),geo:null,tem:field(form,'tem')==='true'};
  for(const key of ['cidade','nome','rua','numero','bairro']) row[key]=field(form,key);
  row.serial=row.tem?field(form,'serial',false):'';
  if(form.has('geo')) {
    let g;try {g=JSON.parse(field(form,'geo'));} catch {fail('Localização inválida.');}
    if(!g||![g.lat,g.lon,g.acc].every(Number.isFinite)||Math.abs(g.lat)>90||Math.abs(g.lon)>180||g.acc<0) fail('Localização inválida.');
    row.geo={lat:g.lat,lon:g.lon,acc:g.acc};
  }
  const photos={fachada:null,medidor:null};
  for(const key of Object.keys(photos)) {
    row[key]=null;
    const file=form.get(key);
    if(!file||(key==='medidor'&&!row.tem)) continue;
    if(typeof file==='string'||!file.size||file.size>1900000) fail('Cada foto deve ter até 1,9 MB.',413);
    const ext=file.name.split('.').pop().toLowerCase();
    if(!/^(jpe?g|png|webp|heic|heif|gif|avif|bmp|tiff?)$/.test(ext)) fail('Formato de imagem incompatível.');
    photos[key]=Buffer.from(await file.arrayBuffer()).toString('base64');
    row[key]={ext};
  }
  await sql`INSERT INTO campo_registros (id,dados,fachada,medidor)
    VALUES (${id},${JSON.stringify(row)}::jsonb,decode(${photos.fachada},'base64'),decode(${photos.medidor},'base64'))
    ON CONFLICT (id) DO NOTHING`;
  return Response.json({id},{headers:privateHeaders});
}
export default {async fetch(request) {
  try {
    if(!process.env.DATABASE_URL||!process.env.ADMIN_PASSWORD) fail('A central ainda precisa ser configurada.',503);
    const sql=neon(process.env.DATABASE_URL);
    const action=new URL(request.url).searchParams.get('equipe');
    if(action)return await team(request,sql,action);
    if(request.method==='POST') return await save(request,sql);
    if(request.method!=='GET') fail('Método inválido.',405);
    requireAdmin(request);
    const query=new URL(request.url).searchParams;
    if(query.has('foto')) {
      const id=query.get('id'), key=query.get('foto');
      if(!uuid.test(id)||!['fachada','medidor'].includes(key)) fail('Foto inválida.');
      const [row]=await sql`SELECT encode(CASE WHEN ${key}='fachada' THEN fachada ELSE medidor END,'base64') AS foto FROM campo_registros WHERE id=${id}`;
      if(!row?.foto) fail('Foto indisponível.',404);
      return new Response(Buffer.from(row.foto,'base64'),{headers:{...privateHeaders,'Content-Type':'application/octet-stream'}});
    }
    const cursor=query.get('cursor')||'00000000-0000-0000-0000-000000000000';
    if(cursor!=='00000000-0000-0000-0000-000000000000'&&!uuid.test(cursor)) fail('Página inválida.');
    const rows=await sql`SELECT dados FROM campo_registros WHERE id>${cursor}::uuid ORDER BY id LIMIT 101`;
    return Response.json({rows:rows.slice(0,100).map(r=>r.dados),cursor:rows.length>100?rows[99].dados.id:null},{headers:privateHeaders});
  }catch(error){return error instanceof Response?error:new Response('Não foi possível acessar a central. Tente novamente.',{status:503,headers:privateHeaders});}
}};
