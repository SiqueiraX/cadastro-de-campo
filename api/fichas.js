import {neon} from '@neondatabase/serverless';
import {currentWorker,requireAdmin} from '../lib/equipe.js';
import {previstos} from '../lib/vistorias.js';
import {uuid,fail,normalizeFicha} from '../lib/ficha.js';
const headers={'Cache-Control':'private, no-store'};
const reply=data=>Response.json(data,{headers});
const formats={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',heic:'image/heic',heif:'image/heif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff'};
async function attach(request,sql,autor){
  const form=await request.formData(),id=form.get('id'),record=form.get('registro'),file=form.get('imagem'),thumb=form.get('miniatura');
  if(!uuid.test(id)||!uuid.test(record)||!file?.size||file.size>1900000||thumb?.size>150000)fail('Foto inválida ou muito grande.');
  const ext=file.name.split('.').pop().toLowerCase();if(!Object.hasOwn(formats,ext))fail('Formato de foto incompatível.');
  const b64=async blob=>Buffer.from(await blob.arrayBuffer()).toString('base64');
  await sql`INSERT INTO campo_fotos(id,registro,usuario,ext,imagem,miniatura)
    VALUES(${id},${record},${autor.usuario},${ext},decode(${await b64(file)},'base64'),decode(${thumb?.size?await b64(thumb):null},'base64'))
    ON CONFLICT(id) DO NOTHING`;
  return reply({id});
}
async function getPhoto(sql,query,user){
  const id=query.get('id'),key=query.get('foto'),thumb=query.has('mini');
  if(!uuid.test(id))fail('Registro inválido.');
  const [record]=await sql`SELECT dados FROM campo_registros WHERE id=${id} AND (${user}::text IS NULL OR dados->'autor'->>'usuario'=${user})`;
  const r=record?.dados;if(!r)fail('Registro indisponível.',404);
  let image;
  if(['fachada','medidor'].includes(key)&&r[key]){
    [image]=await sql`SELECT encode(CASE WHEN ${key}='fachada' THEN fachada ELSE medidor END,'base64') AS bytes FROM campo_registros WHERE id=${id}`;
    if(image)image.ext=r[key].ext;
  }else if(uuid.test(key)&&[...(r.fotosFachada||[]),...(r.fotosFonte||[]),...(r.hds||[]).flatMap(h=>h.fotos)].includes(key)){
    [image]=await sql`SELECT CASE WHEN ${thumb} AND miniatura IS NOT NULL THEN 'jpg' ELSE ext END AS ext,
      encode(CASE WHEN ${thumb} THEN coalesce(miniatura,imagem) ELSE imagem END,'base64') AS bytes FROM campo_fotos WHERE id=${key} AND registro=${id}`;
  }
  if(!image?.bytes)fail('Foto indisponível.',404);
  return new Response(Buffer.from(image.bytes,'base64'),{headers:{...headers,'Content-Type':formats[image.ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'}});
}
export default {async fetch(request){
 try{
  const sql=neon(process.env.DATABASE_URL),q=new URL(request.url).searchParams;
  const admin=request.method==='GET'&&request.headers.has('authorization');
  if(admin)requireAdmin(request);
  const autor=admin?null:await currentWorker(request,sql);
  if(!admin&&!autor)fail('Entre com sua conta de campo.',401);
  if(request.method==='GET'){
    if(q.has('foto'))return await getPhoto(sql,q,autor?.usuario??null);
    const rows=await sql`SELECT dados FROM campo_registros WHERE dados->'autor'->>'usuario'=${autor?.usuario??null} ORDER BY (dados->>'data')::bigint DESC`;
    return reply(rows.map(r=>r.dados));
  }
  if(request.headers.get('origin')!==new URL(request.url).origin)fail('Origem inválida.',403);
  if(request.method==='POST'&&q.has('upload'))return await attach(request,sql,autor);
  if(!['PUT','POST'].includes(request.method))fail('Método inválido.',405);
  const input=await request.json();if(!uuid.test(input.id))fail('Registro inválido.');
  const [before]=await sql`SELECT dados FROM campo_registros WHERE id=${input.id}`;
  const prev=before?.dados;
  if(prev&&prev.autor?.usuario!==autor.usuario)fail('Este cadastro pertence a outra conta.',403);
  if(request.method==='POST'&&prev)return reply({id:prev.id});
  if(request.method==='PUT'&&!prev)fail('Cadastro não encontrado.',404);
  if(prev&&(prev.revisao??0)!==input.revisao)fail('Cadastro atualizado em outra sessão. Reabra a edição.',409);
  const {row,ids}=normalizeFicha(input,prev,autor);
  if(row.local_id&&!previstos.some(p=>p.id===row.local_id)&&row.local_id!==prev?.local_id)fail('Local desconhecido.');
  if(ids.length){
    const [ok]=await sql`SELECT count(*)::int AS n FROM campo_fotos WHERE registro=${row.id} AND usuario=${autor.usuario} AND id=ANY(${ids}::uuid[])`;
    if(ok.n!==ids.length)fail('Algumas fotos ainda não chegaram. Tente enviar novamente.');
  }
  if(prev){
    const removed=[...(prev.fotosFachada||[]),...(prev.fotosFonte||[]),...(prev.hds||[]).flatMap(h=>h.fotos)].filter(id=>uuid.test(id)&&!ids.includes(id));
    const updated=await sql`WITH saved AS (UPDATE campo_registros SET dados=${JSON.stringify(row)}::jsonb WHERE id=${row.id} AND coalesce((dados->>'revisao')::int,0)=${input.revisao} AND dados->'autor'->>'usuario'=${autor.usuario} RETURNING id),
      removed AS (DELETE FROM campo_fotos f USING saved WHERE f.registro=saved.id AND f.id=ANY(${removed}::uuid[])) SELECT id FROM saved`;
    if(!updated.length)fail('Cadastro alterado. Reabra a edição.',409);
  }else await sql`INSERT INTO campo_registros(id,dados) VALUES(${row.id},${JSON.stringify(row)}::jsonb)`;
  return reply({id:row.id});
 }catch(error){if(error instanceof Response)return error;return new Response(error.code==='23505'?'Este local já foi cadastrado. Atualize o mapa.':'Falha ao salvar ou consultar. Tente novamente.',{status:error.code==='23505'?409:503,headers})}
}};
