let editing=null,front=[],source=[],meters=[];
const addressKeys=['cidade','nome','rua','numero','bairro'];
const ui=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
function button(text,fn){const el=ui('button',text,'secondary');el.type='button';el.onclick=fn;return el}
function clearGPS(){geo=null;++gpsToken;$('gps').disabled=false;$('coords').textContent='Use a posição atual do celular.'}
function stored(row){
 const facade=row.fotosFachada??(row.fachada?['fachada']:[]);
 const hds=row.hds??(row.tem?[{numero:row.serial||'',fotos:row.medidor?['medidor']:[]}]:[]);
 return {facade,hds,source:row.fotosFonte||[]};
}
function gallery(row){
 const all=stored(row);
 return [...all.facade.map(id=>({id,group:'fachada'})),...all.hds.flatMap((h,i)=>h.fotos.map(id=>({id,group:'hd-'+(i+1)}))),...all.source.map(id=>({id,group:'fonte'}))];
}
async function getImage(rowId,id,mini,admin){
 const url='/api/fichas?id='+encodeURIComponent(rowId)+'&foto='+encodeURIComponent(id)+(mini?'&mini=1':'');
 const res=await (admin?adminFetch(url):fetch(url,{cache:'no-store'}));
 if(!res.ok)throw Error('Não foi possível abrir a foto.');
 return res.blob();
}
const loadedImages=new Map();
const observer=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){
  if(!isIntersecting)continue;observer.unobserve(target);
  const {record,photo,admin}=target.dataset;
  getImage(record,photo,true,admin==='1').then(blob=>{
   if(!target.isConnected)return;const url=URL.createObjectURL(blob);loadedImages.set(target,url);target.src=url;
  }).catch(()=>target.alt='Prévia indisponível');
 }
},{rootMargin:'100px'});
function purge(container){
 for(const img of container.querySelectorAll('img')){observer.unobserve(img);const url=loadedImages.get(img);if(url)URL.revokeObjectURL(url);loadedImages.delete(img)}
 container.replaceChildren();
}
function thumb(record,id,admin,label){
 const img=ui('img');img.alt=label;img.dataset.record=record;img.dataset.photo=id;img.dataset.admin=admin?'1':'0';img.loading='lazy';observer.observe(img);return img;
}
function tile(list,container,title){
 purge(container);
 const actions=ui('div',null,'photo-actions'),strip=ui('div',null,'photo-strip');
 for(const [label,camera] of [['Tirar foto',true],['Galeria',false]]){
  const wrap=ui('label',label,'pick-photo'),input=ui('input');input.type='file';input.setAttribute('aria-label',label+' · '+title);input.accept='image/*';input.multiple=!camera;
  if(camera)input.setAttribute('capture','environment');
  input.onchange=()=>{for(const file of input.files){list.push({id:crypto.randomUUID(),file,url:URL.createObjectURL(file)})}tile(list,container,title)};
  wrap.append(input);actions.append(wrap);
 }
 container.append(actions,ui('small',list.length+' foto(s)','muted'),strip);
 list.forEach((p,i)=>{
  const item=ui('div',null,'photo-item');
  const img=p.file?ui('img'):thumb(editing?.id||submissionId,p.id,false,title+' '+(i+1));
  if(p.file){img.src=p.url;img.alt=title+' '+(i+1)}
  item.append(img,button('Remover',()=>{if(p.url)URL.revokeObjectURL(p.url);list.splice(i,1);tile(list,container,title)}));strip.append(item);
 });
}
function renderMeters(){
 const box=$('hdList');purge(box);
 meters.forEach((meter,i)=>{
  const section=ui('div',null,'hd-card'),label=ui('label','Número do HD '+(i+1)),number=ui('input');
  number.value=meter.numero;number.maxLength=180;number.oninput=()=>meter.numero=number.value;label.append(number);
  const group=ui('div');section.append(label,group);
  if(meters.length>1)section.append(button('Remover HD '+(i+1),()=>{
   if((meter.numero||meter.fotos.length)&&!confirm('Remover este HD e suas fotos do formulário?'))return;
   meter.fotos.forEach(p=>{if(p.url)URL.revokeObjectURL(p.url)});meters.splice(i,1);renderMeters();
  }));
  box.append(section);tile(meter.fotos,group,'HD '+(i+1));
 });
}
function renderFields(){
 $('meter').hidden=!f.tem.checked;$('sourceArea').hidden=!f.fonte.checked;
 tile(front,$('frontPhotos'),'Fachada');tile(source,$('sourcePhotos'),'Fonte alternativa');renderMeters();
}
function resetFicha(){
 for(const p of [...front,...source,...meters.flatMap(h=>h.fotos)])if(p.url)URL.revokeObjectURL(p.url);
 editing=null;front=[];source=[];meters=[{numero:'',fotos:[]}];submissionId=crypto.randomUUID();
 form.reset();clearPlace();clearGPS();renderFields();$('editNotice').hidden=true;$('save').textContent='Enviar cadastro';
}
function hasDraft(){return !!(editing||selectedPlace||front.length||source.length||geo||f.tem.checked||f.fonte.checked||[...addressKeys,'observacao','reservacao','funcionarios','clientes','reagente'].some(k=>f[k].value))}
f.tem.onchange=()=>$('meter').hidden=!f.tem.checked;
f.fonte.onchange=()=>$('sourceArea').hidden=!f.fonte.checked;
$('addHD').onclick=()=>{meters.push({numero:'',fotos:[]});renderMeters()};
$('cancelEdit').onclick=()=>{if(!busy)resetFicha()};
function startEditing(row){
 if(busy||hasDraft()&&!confirm('Abrir este cadastro e descartar o rascunho atual?'))return;
 resetFicha();editing=row;submissionId=row.id;const old=stored(row),ref=id=>({id});
 for(const k of [...addressKeys,'reservacao','funcionarios','clientes','observacao'])f[k].value=row[k]??'';
 f.tem.checked=!!row.tem;f.fonte.checked=!!row.fonte;f.reagente.value=row.reagente==null?'':row.reagente?'sim':'nao';
 front=old.facade.map(ref);source=old.source.map(ref);meters=old.hds.map(h=>({numero:h.numero,fotos:h.fotos.map(ref)}));
 if(!meters.length)meters=[{numero:'',fotos:[]}];geo=row.geo||null;if(geo)$('coords').textContent=geo.lat+', '+geo.lon;
 selectedPlace=row.local_id||null;if(selectedPlace){$('chosenName').textContent=row.nome;$('chosenPlace').hidden=false}
 renderFields();$('editNotice').hidden=false;$('save').textContent='Salvar alterações';form.scrollIntoView({block:'start'});
}
async function myRecords(){
 if(!$('myRecords').open||!worker)return;
 const who=worker.usuario;
 try{const res=await fetch('/api/fichas',{cache:'no-store'});if(!res.ok)throw Error('Entre novamente para ver seus cadastros.');const rows=await res.json();if(worker?.usuario===who)renderCards($('myList'),rows,false)}catch(e){report(e)}
}
$('myRecords').ontoggle=myRecords;
async function previewBlob(file){
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,280/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.73));
 }catch{return null}finally{URL.revokeObjectURL(url)}
}
async function upload(p){
 if(!p.file||p.uploaded)return;
 const data=new FormData(),file=await preparePhoto(p.file);
 data.set('id',p.id);data.set('registro',submissionId);data.set('imagem',file,file.name);
 const mini=await previewBlob(file);if(mini)data.set('miniatura',mini,'mini.jpg');
 const res=await fetch('/api/fichas?upload=1',{method:'POST',body:data});
 if(!res.ok)throw Error(await res.text());p.uploaded=true;
}
form.onsubmit=async e=>{
 e.preventDefault();if(busy)return;
 if(f.fonte.checked&&source.length<3){report(Error('Adicione pelo menos 3 fotos da fonte alternativa.'));$('sourceArea').scrollIntoView({block:'center'});return}
 if($('gps').disabled){report(Error('Aguarde a captura da localização.'));return}
 const activeHD=f.tem.checked?meters:[],activeSource=f.fonte.checked?source:[];
 const ids=list=>list.map(p=>p.id);
 const row={id:submissionId,revisao:editing?.revisao??0,local_id:selectedPlace,geo,tem:f.tem.checked,fonte:f.fonte.checked,
  reagente:f.reagente.value===''?null:f.reagente.value==='sim',fotosFachada:ids(front),fotosFonte:ids(activeSource),hds:activeHD.map(h=>({numero:h.numero,fotos:ids(h.fotos)}))};
 for(const k of [...addressKeys,'observacao','reservacao'])row[k]=f[k].value.trim();
 for(const k of addressKeys){f[k].value=row[k];if(!f[k].reportValidity())return}
 for(const k of ['funcionarios','clientes'])row[k]=f[k].value===''?null:Number(f[k].value);
 busy=true;form.inert=true;$('save').disabled=true;
 try{
  const files=[...front,...activeHD.flatMap(h=>h.fotos),...activeSource].filter(p=>p.file&&!p.uploaded);
  for(const [i,p] of files.entries()){$('status').textContent='Enviando foto '+(i+1)+' de '+files.length+'…';await upload(p)}
  $('status').textContent='Salvando cadastro…';
  const res=await fetch('/api/fichas',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)});
  if(!res.ok)throw Error(await res.text());
  const success=editing?'Alterações salvas.':'Cadastro recebido na central.';resetFicha();view(false);loadPlaces();await myRecords();$('status').textContent=success;
 }catch(err){report(err);if(/Entre com sua conta/.test(err.message)){worker=null;renderAccess()}}finally{busy=false;form.inert=false;$('save').disabled=false}
};
function renderCards(container,rows,admin){
 purge(container);container.className='records-grid';
 if(!rows.length){container.textContent='Nenhum cadastro encontrado.';return}
 for(const row of rows){
  const card=ui('article',null,'record-card'),meta=ui('div',null,'record-meta'),pics=gallery(row);
  meta.append(ui('span',row.cidade||'Cidade não informada'),ui('time',new Date(row.data).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})));
  card.append(meta,ui('h3',row.nome),ui('p',[row.rua,row.numero,row.bairro].filter(Boolean).join(', ')),ui('p',row.autor?.nome||'Responsável não identificado','muted'));
  if(pics.length){const photos=ui('div',null,'card-pictures');for(const p of pics){const image=thumb(row.id,p.id,admin,p.group);const link=button('',async()=>{
   const dialog=document.createElement('dialog'),close=button('Fechar',()=>dialog.close());dialog.append(close,ui('p','Carregando foto…'));document.body.append(dialog);dialog.showModal();
   let url;dialog.onclose=()=>{if(url)URL.revokeObjectURL(url);dialog.remove()};
   try{const blob=await getImage(row.id,p.id,false,admin);if(!dialog.open)return;url=URL.createObjectURL(blob);const big=ui('img');big.src=url;big.alt=p.group;dialog.replaceChildren(close,big)}catch{if(dialog.open)dialog.lastChild.textContent='Foto indisponível.'}
  });link.setAttribute('aria-label','Abrir foto de '+p.group);link.append(image);photos.append(link)}card.append(photos)}
  const info=ui('details'),sum=ui('summary','Dados da vistoria');info.append(sum);
  for(const [k,v] of [['HDs',row.tem?stored(row).hds.map((h,i)=>'HD '+(i+1)+(h.numero?' · '+h.numero:'')).join(', '):'Não'],['Fonte alternativa',row.fonte==null?null:row.fonte?'Sim':'Não'],['Reservação',row.reservacao],['Funcionários',row.funcionarios],['Média de clientes',row.clientes],['Reagente',row.reagente==null?null:row.reagente?'Sim':'Não'],['Observação',row.observacao]])if(v!==null&&v!==undefined&&v!=='')info.append(ui('p',k+': '+v));
  card.append(info);if(!admin)card.append(button('Editar cadastro',()=>startEditing(row)));container.append(card);
 }
}
$('export').onclick=async()=>{
 if(!items.length)return;
 try{await refresh();$('export').disabled=true;$('status').textContent='Preparando Excel e fotos…';
  const file=await exportRecords(visibleRows());const url=URL.createObjectURL(file),a=ui('a');a.href=url;a.download='levantamento-'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);$('status').textContent='Arquivo preparado para download.';
 }catch(err){report(err)}finally{$('export').disabled=!items.length}
};
resetFicha();
