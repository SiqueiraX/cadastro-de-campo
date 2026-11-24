const enc=new TextEncoder();
const table=Uint32Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=(i>>>1)^((i&1)?0xedb88320:0);return i>>>0});
function header(size,fields){
  const bytes=new Uint8Array(size), view=new DataView(bytes.buffer);
  for(const [offset,length,value] of fields)view[length===2?'setUint16':'setUint32'](offset,value,true);
  return bytes;
}
async function zip(entries){
  const parts=[], directory=[];let offset=0,dirSize=0;
  for(const [name,value] of entries){
    const file=new Blob([value]),path=enc.encode(name),size=file.size;
    if(offset+size>0xffffffff || entries.length>65535)throw Error('O lote excede o limite do ZIP.');
    let crc=0xffffffff;
    for(let p=0;p<size;p+=1048576){
      const bytes=new Uint8Array(await file.slice(p,p+1048576).arrayBuffer());
      for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);
    }
    crc=(crc^0xffffffff)>>>0;
    const local=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,2048],[12,2,33],[14,4,crc],[18,4,size],[22,4,size],[26,2,path.length]]);
    const central=header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,2048],[14,2,33],[16,4,crc],[20,4,size],[24,4,size],[28,2,path.length],[42,4,offset]]);
    parts.push(local,path,file);directory.push(central,path);offset+=30+path.length+size;dirSize+=46+path.length;
  }
  return new Blob([...parts,...directory,header(22,[[0,4,0x06054b50],[8,2,entries.length],[10,2,entries.length],[12,4,dirSize],[16,4,offset]])],{type:'application/zip'});
}
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function workbook(rows){
  const ns='http://schemas.openxmlformats.org/', ss=ns+'spreadsheetml/2006/main', rel=ns+'officeDocument/2006/relationships';
  const links=(kind,target)=>'<Relationships xmlns="'+ns+'package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/'+kind+'" Target="'+target+'"/></Relationships>';
  const data=rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>{const pos=String.fromCharCode(65+c)+(r+1);return typeof v==='number'?'<c r="'+pos+'"><v>'+v+'</v></c>':'<c r="'+pos+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>'}).join('')+'</row>').join('');
  return zip([
    ['[Content_Types].xml','<Types xmlns="'+ns+'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels',links('officeDocument','xl/workbook.xml')],['xl/_rels/workbook.xml.rels',links('worksheet','worksheets/sheet1.xml')],
    ['xl/workbook.xml','<workbook xmlns="'+ss+'" xmlns:r="'+rel+'"><sheets><sheet name="Empreendimentos" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/worksheets/sheet1.xml','<worksheet xmlns="'+ss+'"><cols><col min="1" max="23" width="23" customWidth="1"/></cols><sheetData>'+data+'</sheetData><autoFilter ref="A1:W'+rows.length+'"/></worksheet>']
  ]);
}
async function exportRecords(items){
  const rows=[['ID','Data e hora local','Responsável','Usuário','Cidade','Empreendimento','Rua','Número','Bairro','Latitude','Longitude','Precisão (m)','Tem medidor?','Números dos HDs','Fotos da fachada','Fotos dos HDs','Observação','Fonte alternativa','Fotos da fonte','Reservação','Funcionários','Média de clientes','Reagente']],files=[];
  for(const r of items){
    const name=r.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,50);
    const groups={fachada:[],hd:[],fonte:[]},sequence={};
    for(const p of gallery(r)){
      const blob=await getImage(r.id,p.id,false,true);
      const ext=blob.type.split('/').pop().replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'')||'img';
      sequence[p.group]=(sequence[p.group]||0)+1;
      const path='fotos/'+r.id+'-'+name+'/'+p.group+'-'+sequence[p.group]+'.'+ext;
      files.push([path,blob]);groups[p.group.startsWith('hd-')?'hd':p.group].push(path);
    }
    const yesNo=v=>v==null?'':v?'Sim':'Não';
    rows.push([r.id,new Date(r.data).toLocaleString('pt-BR'),r.autor?.nome||'Sem identificação',r.autor?.usuario,r.cidade,r.nome,r.rua,r.numero,r.bairro,r.geo?.lat,r.geo?.lon,r.geo?.acc,yesNo(r.tem),stored(r).hds.map((h,i)=>'HD '+(i+1)+': '+(h.numero||'sem número')).join(' | '),groups.fachada.join(' | '),groups.hd.join(' | '),r.observacao,yesNo(r.fonte),groups.fonte.join(' | '),r.reservacao,r.funcionarios,r.clientes,yesNo(r.reagente)]);
  }
  return zip([['empreendimentos.xlsx',await workbook(rows)],...files]);
}
