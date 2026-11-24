export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fail(message,status=400){throw new Response(message,{status,headers:{'Cache-Control':'no-store'}})}
export function normalizeFicha(input,previous,autor){
  const text=(value,limit=180)=>{if(typeof value!=='string'||value.length>limit)fail('Confira os campos de texto.');return value.trim()};
  const count=value=>{if(value==null||value==='')return null;if(!Number.isSafeInteger(value)||value<0)fail('Informe uma quantidade inteira igual ou maior que zero.');return value};
  const row={id:input.id,autor,data:previous?.data??Date.now(),revisao:(previous?.revisao??0)+1,alterado:Date.now()};
  for(const k of ['cidade','nome','rua','numero','bairro']){
    row[k]=text(input[k]);if(!row[k])fail('Preencha cidade, empreendimento e endereço.');
  }
  if(input.local_id)row.local_id=text(input.local_id);
  row.observacao=text(input.observacao??'',2000);row.reservacao=text(input.reservacao??'',500);
  row.funcionarios=count(input.funcionarios);row.clientes=count(input.clientes);
  if(![true,false,null,undefined].includes(input.reagente))fail('Confira o campo reagente.');
  row.reagente=input.reagente??null;
  row.geo=null;
  if(input.geo){const {lat,lon,acc}=input.geo;if(![lat,lon,acc].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||acc<0)fail('Localização inválida.');row.geo={lat,lon,acc}}
  const seen=new Set();
  function refs(list,legacyKey){
    if(!Array.isArray(list))fail('Lista de fotos inválida.');
    return list.map(id=>{
      const legacy=!!legacyKey && id===legacyKey && (previous?.[legacyKey]||previous?.fotosFachada?.includes(id)||previous?.hds?.some(h=>h.fotos.includes(id)));
      if(typeof id!=='string'||(!uuid.test(id)&&!legacy)||seen.has(id))fail('Foto repetida ou inválida.');
      seen.add(id);return id;
    });
  }
  row.fotosFachada=refs(input.fotosFachada,'fachada');
  row.tem=input.tem===true;
  if(!Array.isArray(input.hds)||(row.tem&&!input.hds.length))fail('Informe ao menos um HD.');
  row.hds=row.tem?input.hds.map(h=>({numero:text(h.numero),fotos:refs(h.fotos,'medidor')})):[];
  row.serial=row.hds.map(h=>h.numero).filter(Boolean).join(', ');
  row.fonte=input.fonte===true;row.fotosFonte=row.fonte?refs(input.fotosFonte,''):[];
  if(row.fonte&&row.fotosFonte.length<3)fail('Adicione no mínimo 3 fotos da fonte alternativa.');
  for(const key of ['fachada','medidor'])if(seen.has(key))row[key]=previous[key];
  return {row,ids:[...seen].filter(id=>uuid.test(id))};
}
