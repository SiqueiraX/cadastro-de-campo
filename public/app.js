const $=id=>document.getElementById(id),form=$('form'), f=form.elements;
const icons={building:'M4 21V4h12v17M2 21h20M16 10h4v11M8 8h1m2 0h1m-4 4h1m2 0h1m-4 9v-5h4v5',camera:'M3 7h4l2-3h6l2 3h4v13H3z M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0',meter:'M3 17a9 9 0 1 1 18 0v3H3z M12 15l4-5 M6 14h1m5-7v1',loc:'M21 3l-7 18-3-8-8-3z'};
document.querySelectorAll('[data-icon]').forEach(i=>i.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+icons[i.dataset.icon]+'"/></svg>');
function drawMap(){
 const canvas=$('map'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio;canvas.width=w*dpr;canvas.height=h*dpr;
 const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.strokeStyle='#41e3ce';ctx.lineWidth=1.3;
 for(let n=0;n<34;n++){ctx.beginPath();for(let j=0;j<=240;j++){const t=j*Math.PI/120,r=(13+n*6)*(1+.15*Math.sin(3*t+.7)+.08*Math.cos(5*t));const x=w*.92+Math.cos(t)*r*1.37,y=h*.63+Math.sin(t)*r*.69+.27*Math.cos(t)*r;j?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.globalAlpha=.5-n*.009;ctx.stroke()}
 const g=ctx.createLinearGradient(w*.3,0,w*.89,0);g.addColorStop(0,'#0b349e');g.addColorStop(1,'#0b349e00');ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(0,0,w,h)
}
new ResizeObserver(drawMap).observe($('map'));
let geo=null,gpsToken=0,items=[],busy=false;
let worker=null;
function renderAccess(){
 const admin=!$('records').hidden;
 $('workerLogin').hidden=admin||!!worker;
 form.hidden=admin||!worker;
 $('identity').hidden=admin||!worker;$('myRecords').hidden=admin||!worker;
 showVisitMap(admin?!!adminPassword&&!$('teamPanel').hidden:!!worker);
 $('person').textContent=worker?'Responsável: '+worker.nome+' (@'+worker.usuario+')':'';
}
async function account(action,body,admin=false){
 const options=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
 if(admin)options.headers.Authorization='Bearer '+adminPassword;
 const response=await fetch('/api/registros?equipe='+action,options);
 if(!response.ok)throw Error(await response.text());
 return response.json();
}
$('workerLogin').onsubmit=async event=>{
 event.preventDefault();const login=event.currentTarget;
 try{const result=await account('entrar',Object.fromEntries(new FormData(login)));worker=result.pessoa;login.reset();view(false)}catch(err){report(err)}
};
$('logout').onclick=async()=>{
 try{await account('sair',{});worker=null;resetFicha();$('myList').replaceChildren();$('myRecords').open=false;view(false)}catch(err){report(err)}
};
$('addWorker').onsubmit=async event=>{
 event.preventDefault();const create=event.currentTarget;
 try{const user=await account('criar',Object.fromEntries(new FormData(create)),true);create.reset();$('accountStatus').textContent='Acesso criado para '+user.nome+' (@'+user.usuario+').'}catch(err){$('accountStatus').textContent=err.message}
};
function view(list){
 $('records').hidden=!list;renderAccess();$('novo').setAttribute('aria-pressed',String(!list));$('lista').setAttribute('aria-pressed',String(list));
 $('title').textContent=list?'Cadastros de campo':'Novo empreendimento';$('intro').textContent=list?'Consulte e exporte os levantamentos de toda a equipe.':'Registre os dados, a localização e as fotos do imóvel.';
 $('status').textContent='';window.scrollTo(0,0);
}
let adminPassword='';
const adminFetch=url=>fetch(url,{headers:{Authorization:'Bearer '+adminPassword},cache:'no-store'});
async function refresh(){const result=[];let cursor='';do{const response=await adminFetch('/api/registros?cursor='+encodeURIComponent(cursor));if(response.status===401){adminPassword='';$('teamPanel').hidden=true;showVisitMap(false);$('rows').replaceChildren();items=[];$('export').disabled=true;$('login').hidden=false;throw Error('Informe a senha administrativa.');}if(!response.ok)throw Error(response.status===403?'Acesso exclusivo do administrador.':'Falha ao carregar os cadastros.');const page=await response.json();result.push(...page.rows);cursor=page.cursor}while(cursor);items=result;$('count').textContent=items.length;$('export').disabled=!items.length;
 const select=$('responsavel'),previous=select.value;
 const people=new Map(items.map(r=>[r.autor?.usuario||'__legacy__',r.autor?r.autor.nome+' (@'+r.autor.usuario+')':'Sem identificação']));
 select.replaceChildren(new Option('Toda a equipe',''));
 for(const [id,name] of people)select.add(new Option(name,id));
 if(people.has(previous))select.value=previous;
 $('teamPanel').hidden=false;showVisitMap(true);renderRows();
}
function visibleRows(){const selected=$('responsavel').value;return items.filter(r=>!selected||(r.autor?.usuario||'__legacy__')===selected).sort((a,b)=>b.data-a.data)}
function renderRows(){renderCards($('rows'),visibleRows(),true)}
$('responsavel').onchange=renderRows;
function report(error){$('status').textContent=error.message||'Verifique a conexão e tente novamente.'}
$('novo').onclick=()=>view(false);$('lista').onclick=()=>{view(true);$('login').hidden=!!adminPassword;if(adminPassword)refresh().catch(report)};
$('login').onsubmit=async e=>{e.preventDefault();adminPassword=$('senha').value;try{await refresh();$('login').hidden=true;$('senha').value='';$('status').textContent=''}catch(err){report(err)}};
account('sessao').then(({pessoa})=>{worker=pessoa;renderAccess()}).catch(report);
if(location.pathname==='/admin')$('lista').click();
let submissionId=crypto.randomUUID();

$('gps').onclick=()=>{const token=++gpsToken;geo=null;
 if(!navigator.geolocation){$('coords').textContent='Abra o site em HTTPS em um navegador com localização.';return}
 $('gps').disabled=true;$('coords').textContent='Buscando a posição do celular…';
 navigator.geolocation.getCurrentPosition(({coords:c})=>{if(token!==gpsToken)return;geo={lat:c.latitude,lon:c.longitude,acc:c.accuracy};$('coords').textContent=c.latitude.toFixed(6)+', '+c.longitude.toFixed(6)+' · precisão de '+Math.round(c.accuracy)+' m';$('gps').disabled=false},err=>{if(token!==gpsToken)return;$('coords').textContent=err.code===1?'Permita o acesso à localização no navegador e tente novamente.':'Posição indisponível. Tente novamente.';$('gps').disabled=false},{enableHighAccuracy:true,timeout:20000,maximumAge:0})
};
async function preparePhoto(file){
 if(file.size<=1900000)return file;
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  const scale=Math.min(1,2200/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.86,.72,.55,.40]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=1900000)return new File([blob],'foto.jpg',{type:'image/jpeg'})}
 }catch{}finally{URL.revokeObjectURL(url)}
 throw Error('Escolha uma foto menor ou em JPEG para concluir o envio.');
}
