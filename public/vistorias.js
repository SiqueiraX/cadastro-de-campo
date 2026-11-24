let selectedPlace=null;
let mapView=null, markers=[], mapRequest=0, libraryPromise=null;
let fitted=false;
const mapCard=document.getElementById('visitMapCard');
const mapElement=document.getElementById('visitMap');
const message=document.getElementById('mapMessage');
function clearPlace(){
  selectedPlace=null;
  document.getElementById('chosenPlace').hidden=true;
}
document.getElementById('detachPlace').onclick=()=>{if(busy)return;for(const key of ['cidade','nome','rua','numero','bairro'])f[key].value='';clearPlace();clearGPS();f.cidade.focus()};
function choosePlace(point){
  if(busy)return;
  const fields=['cidade','nome','rua','numero','bairro'];
  if(hasDraft()&&!confirm('Substituir o rascunho atual pela vistoria deste local?'))return;
  resetFicha();closePinPanel();
  for(const key of fields)f[key].value=point[key]||'';
  selectedPlace=point.id;submissionId=crypto.randomUUID();
  $('chosenName').textContent='Vistoria de '+point.nome;$('chosenPlace').hidden=false;
  form.scrollIntoView({block:'start',behavior:'smooth'});
}
function hasCoordinates(place){
  return Number.isFinite(place.geo?.lon)&&Math.abs(place.geo.lon)<=180&&Number.isFinite(place.geo.lat)&&Math.abs(place.geo.lat)<=90;
}
function detailsFor(point){
  const box=document.createElement('div');box.className='place-detail';
  const title=document.createElement('strong');title.textContent=point.nome;
  const status=document.createElement('p');status.textContent=point.estado==='pendente'?'◷ Pendente':'✓ Concluída';
  const address=document.createElement('p');address.textContent=[point.rua,point.numero,point.bairro,point.cidade].filter(Boolean).join(', ');
  box.append(title,status,address);
  const links=document.createElement('div');links.className='route-links';links.setAttribute('aria-label','Abrir rota');
  const coordinates=hasCoordinates(point);
  const dest=encodeURIComponent(coordinates?point.geo.lat+','+point.geo.lon:address.textContent);
  const routes=[['Google Maps','https://www.google.com/maps/dir/?api=1&destination='+dest+'&dir_action=navigate'],
    ['Apple Mapas','https://maps.apple.com/?daddr='+dest+'&dirflg=d']];
  if(coordinates)routes.push(['Waze','https://waze.com/ul?ll='+dest+'&navigate=yes']);
  if(dest){
    const label=document.createElement('p');label.textContent='Abrir rota';box.append(label);
    for(const [name,href] of routes){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=name;links.append(a)}
    box.append(links);
  }
  if(point.estado==='pendente'&&worker&&$('records').hidden){
    const start=document.createElement('button');start.type='button';start.className='start-visit';start.textContent='Iniciar vistoria';start.onclick=()=>choosePlace(point);box.append(start);
  }
  return box;
}
function mapLibrary(){
  if(window.maplibregl)return Promise.resolve(window.maplibregl);
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/maplibre-gl.css';document.head.append(css);
    const js=document.createElement('script');js.src='/vendor/maplibre-gl.js';js.onload=()=>resolve(window.maplibregl);
    js.onerror=()=>{libraryPromise=null;reject(Error('Mapa indisponível.'))};document.head.append(js);
  });
  return libraryPromise;
}
function brandStyle(_,style){
  const layers=style.layers.filter(l=>{
    if(l.type!=='symbol')return true;
    return !l.layout?.['icon-image']&&!/poi|housenumber|airport|transit/i.test(l.id);
  }).map(layer=>{
    const paint={...layer.paint};
    if(layer.type==='background')paint['background-color']='#eff7f6';
    if(layer.type==='fill'&&layer['source-layer']==='water')paint['fill-color']='#96e4dc';
    if(layer.type==='fill'&&layer['source-layer']==='building')paint['fill-color']='#d2e0e4';
    if(layer.type==='symbol')paint['text-color']='#345775';
    return {...layer,paint};
  });
  return {...style,layers};
}
function closePinPanel(){document.getElementById('pinPanel')?.remove()}
function showPinPanel(point){
  closePinPanel();const panel=document.createElement('div');panel.id='pinPanel';panel.setAttribute('role','region');panel.setAttribute('aria-label','Detalhes do local');
  const close=document.createElement('button');close.type='button';close.className='pin-close';close.textContent='Fechar';close.onclick=closePinPanel;
  panel.append(close,detailsFor(point));mapElement.append(panel);close.focus({preventScroll:true});
}
function clearMarkers(){closePinPanel();for(const marker of markers)marker.remove();markers=[]}
function paintPoints(lib,points){
  if(!mapView){
    mapView=new lib.Map({container:mapElement,center:[-55.503,-11.86],zoom:11,attributionControl:true});
    mapView.setStyle('https://tiles.openfreemap.org/styles/positron',{transformStyle:brandStyle});
    mapView.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
    mapView.on('error',()=>{message.textContent='Algumas partes do mapa não carregaram. As rotas também estão na lista de locais.'});
  }
  clearMarkers();mapView.resize();
  const bounds=new lib.LngLatBounds();
  for(const point of points.filter(hasCoordinates)){
    const pos=[point.geo.lon,point.geo.lat],done=point.estado==='concluido';
    const button=document.createElement('button');button.type='button';button.className='visit-pin'+(done?' done':'');
    button.textContent=done?'✓':'◷';button.setAttribute('aria-label',point.nome+' · '+(done?'Concluída':'Pendente'));
    const marker=new lib.Marker({element:button,anchor:'bottom'}).setLngLat(pos)
      .addTo(mapView);
    button.onclick=()=>showPinPanel(point);
    markers.push(marker);bounds.extend(pos);
  }
  if(!fitted&&markers.length){mapView.fitBounds(bounds,{padding:55,maxZoom:16,duration:0});fitted=true}
}
async function loadPlaces(){
  if(mapCard.hidden)return;
  const ticket=++mapRequest;
  message.textContent='Carregando locais…';
  try{
    const options=worker?{cache:'no-store'}:{cache:'no-store',headers:{Authorization:'Bearer '+adminPassword}};
    const response=await fetch('/api/registros?mapa=1',options);
    if(!response.ok)throw Error('Falha ao carregar as vistorias. Entre novamente ou toque em Atualizar.');
    const points=await response.json();
    if(ticket!==mapRequest)return;
    const list=$('visitList');list.replaceChildren(...points.map(detailsFor));
    const missing=points.filter(p=>!hasCoordinates(p)).length;
    message.textContent=!points.length?'Nenhum local de vistoria cadastrado ainda.':missing?missing+' local(is) sem coordenadas. Consulte a lista para abrir a rota pelo endereço.':'Toque em um pin para ver o endereço e abrir a rota.';
    const lib=await mapLibrary();
    if(ticket===mapRequest)paintPoints(lib,points);
  }catch(error){if(ticket===mapRequest)message.textContent=error.message||'Mapa indisponível. Consulte a lista de locais.'}
}
function showVisitMap(show){
  if(show===!mapCard.hidden)return;
  mapCard.hidden=!show;
  if(show){loadPlaces();return}
  ++mapRequest;clearMarkers();$('visitList').replaceChildren();message.textContent='';fitted=false;
  if(mapView){mapView.remove();mapView=null}
}
document.getElementById('reloadMap').onclick=loadPlaces;
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!mapCard.hidden)loadPlaces()});
