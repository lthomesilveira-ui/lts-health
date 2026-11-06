import {CONFIG,fixtureMode,sb,state} from './core.js';
import {localDateValue} from './entry.js';
import {validLocalDate} from './hydration.js';

const pageSize=50;
const maxSize=50*1024*1024;
const photoName=/^(\d{4}-\d{2}-\d{2})-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\.(jpg|png|heic)$/i;
const mime={jpg:'image/jpeg',png:'image/png',heic:'image/heic'};
let active=null;

export function progressPhotosControl(){
  return fixtureMode||globalThis.LTSPreviewReadOnly?'':'<button type="button" class="ltsDepthLink ltsProgressPhotosControl" data-progress-photos>Fotos de acompanhamento</button>';
}

export async function photoFormat(file){
  if(!file||file.size===0||file.size>maxSize)return null;
  const bytes=new Uint8Array(await file.slice(0,64).arrayBuffer());
  const begins=signature=>signature.every((byte,index)=>bytes[index]===byte);
  if(begins([255,216,255]))return 'jpg';
  if(begins([137,80,78,71,13,10,26,10]))return 'png';
  const brand=offset=>String.fromCharCode(...bytes.subarray(offset,offset+4));
  if(brand(4)==='ftyp'){
    const heic=new Set(['heic','heix','hevc','hevx']);
    const boxSize=new DataView(bytes.buffer).getUint32(0);
    if(boxSize>=16&&heic.has(brand(8)))return 'heic';
    for(let offset=16;offset+4<=Math.min(boxSize,bytes.length);offset+=4){
      if(heic.has(brand(offset)))return 'heic';
    }
  }
  return null;
}

function releaseImage(panel){
  if(panel.url)URL.revokeObjectURL(panel.url);
  panel.url=null;
  panel.viewer.replaceChildren();
}

function dispose(panel){
  if(active!==panel)return;
  active=null;
  releaseImage(panel);
  if(panel.dialog.open)panel.dialog.close();
  panel.dialog.remove();
}

export function syncProgressPhotosSession(){
  if(active&&active.owner!==state.session?.user?.id)dispose(active);
}

export function closeProgressPhotos(){
  if(active)dispose(active);
}

function current(panel){
  return active===panel&&panel.dialog.open&&panel.owner===state.session?.user?.id;
}

async function listPhotos(panel,{append=false}={}){
  if(panel.listing||!current(panel))return;
  panel.listing=true;
  panel.more.hidden=true;
  panel.retry.hidden=true;
  panel.listStatus.textContent='Carregando fotos…';
  try{
    const {data,error}=await panel.bucket.list(panel.folder,{
      limit:pageSize,offset:append?panel.offset:0,sortBy:{column:'name',order:'desc'}
    });
    if(!current(panel))return;
    if(error)throw error;
    if(!append){panel.list.replaceChildren();panel.offset=0;panel.names.clear();}
    panel.offset+=data.length;
    for(const {name} of data){
      const match=photoName.exec(name);
      if(!match||!validLocalDate(match[1])||panel.names.has(name))continue;
      panel.names.add(name);
      const item=document.createElement('li');
      const button=document.createElement('button');
      button.type='button';button.className='ghostSmall';
      button.textContent=`Ver foto de ${match[1].split('-').reverse().join('/')}`;
      button.addEventListener('click',()=>void viewPhoto(panel,name,match[1],match[2].toLowerCase()));
      item.append(button);panel.list.append(item);
    }
    panel.more.hidden=data.length<pageSize;
    panel.listStatus.textContent=panel.names.size||!panel.more.hidden?'':'Nenhuma foto salva.';
  }catch{
    if(current(panel)){panel.listStatus.textContent='Não foi possível carregar as fotos.';panel.retry.hidden=false;}
  }finally{panel.listing=false;}
}

async function viewPhoto(panel,name,date,format){
  const selection=++panel.selection;
  releaseImage(panel);
  const message=document.createElement('p');
  message.setAttribute('role','status');message.textContent='Abrindo foto…';
  panel.viewer.append(message);
  panel.viewer.scrollIntoView({block:'nearest'});
  try{
    const {data,error}=await panel.bucket.download(`${panel.folder}/${name}`);
    if(!current(panel)||selection!==panel.selection)return;
    if(error)throw error;
    panel.url=URL.createObjectURL(data.slice(0,data.size,mime[format]));
    const img=document.createElement('img');
    img.alt=`Foto de acompanhamento de ${date.split('-').reverse().join('/')}`;
    img.addEventListener('load',()=>{message.textContent='';},{once:true});
    img.addEventListener('error',()=>{
      img.remove();message.textContent=format==='heic'?'Foto salva. Este navegador não abre imagens HEIC.':'Não foi possível exibir a imagem.';
    },{once:true});
    img.src=panel.url;
    const download=document.createElement('a');
    download.className='ltsDepthLink';
    download.href=panel.url;
    download.download=`foto-${date}.${format}`;
    download.textContent='Baixar original';
    panel.viewer.append(img,download);
  }catch{
    if(current(panel)&&selection===panel.selection)message.textContent='Não foi possível abrir a foto. Selecione-a novamente para tentar.';
  }
}

async function savePhoto(event,panel){
  event.preventDefault();
  if(panel.saving||!current(panel))return;
  panel.saving=true;
  panel.fields.disabled=true;
  panel.close.disabled=true;
  const {file,date}=panel.form.elements;
  const chosen=file.files?.[0],day=date.value;
  try{
    const format=await photoFormat(chosen);
    if(!current(panel))return;
    if(!format||!validLocalDate(day)){
      panel.status.textContent='Escolha uma data válida e uma foto JPEG, PNG ou HEIC de até 50 MB.';
      return;
    }
    if(panel.pending?.file!==chosen||panel.pending?.date!==day){
      panel.pending={file:chosen,date:day,path:`${panel.folder}/${day}-${crypto.randomUUID()}.${format}`};
    }
    panel.status.textContent='Salvando foto…';
    const {error}=await panel.bucket.upload(panel.pending.path,chosen,{contentType:mime[format],upsert:true});
    if(!current(panel))return;
    if(error)throw error;
    panel.pending=null;file.value='';
    panel.status.textContent='Foto salva.';
    // Queue the refresh when a previous list request is still settling.
    await panel.listRequest;
    panel.listRequest=listPhotos(panel);
    await panel.listRequest;
  }catch{
    if(current(panel))panel.status.textContent='Não foi possível confirmar o envio. Tente salvar a mesma foto novamente.';
  }finally{
    panel.saving=false;panel.fields.disabled=false;panel.close.disabled=false;
  }
}

function openPhotos(){
  const owner=state.session?.user?.id;
  if(active||!owner||fixtureMode||globalThis.LTSPreviewReadOnly)return;
  const dialog=document.createElement('dialog');
  dialog.className='ltsProgressPhotos entryPanel';
  dialog.setAttribute('aria-labelledby','progressPhotosTitle');
  dialog.innerHTML=`<header class="ltsProgressPhotosHeader"><h2 id="progressPhotosTitle">Fotos de acompanhamento</h2><button type="button" class="ghostSmall" data-photos-close autofocus>Fechar</button></header>
    <p>Adicione fotos por data para acompanhar sua evolução. Elas ficam na sua área privada.</p>
    <form class="entryForm" id="progressPhotoForm"><fieldset>
      <label>Data da foto<input name="date" type="date" required></label>
      <label>Foto<input name="file" type="file" accept="image/jpeg,image/png,image/heic,.heic" required></label>
      <button type="submit" class="primary">Salvar foto</button>
    </fieldset><p data-photos-status role="status"></p></form>
    <section aria-label="Fotos salvas">
      <h3>Fotos salvas</h3><div data-photos-viewer></div><p data-photos-list-status role="status"></p><ul data-photos-list></ul>
      <button type="button" class="ghostSmall" data-photos-more hidden>Ver mais fotos</button>
      <button type="button" class="ghostSmall" data-photos-retry hidden>Tentar carregar novamente</button>
    </section>`;
  const find=selector=>dialog.querySelector(selector);
  const panel={owner,dialog,folder:`${owner}/progress-photos`,bucket:sb.storage.from(CONFIG.bucket),
    form:find('form'),fields:find('fieldset'),close:find('[data-photos-close]'),
    status:find('[data-photos-status]'),listStatus:find('[data-photos-list-status]'),
    list:find('[data-photos-list]'),more:find('[data-photos-more]'),retry:find('[data-photos-retry]'),
    viewer:find('[data-photos-viewer]'),names:new Set(),offset:0,selection:0};
  active=panel;
  panel.form.elements.date.value=localDateValue();
  panel.form.addEventListener('submit',event=>void savePhoto(event,panel));
  panel.more.addEventListener('click',()=>{panel.listRequest=listPhotos(panel,{append:true});});
  panel.retry.addEventListener('click',()=>{panel.listRequest=listPhotos(panel);});
  panel.close.addEventListener('click',()=>dispose(panel));
  dialog.addEventListener('cancel',event=>{if(panel.saving)event.preventDefault();});
  dialog.addEventListener('close',()=>dispose(panel));
  document.body.append(dialog);
  dialog.showModal();
  panel.listRequest=listPhotos(panel);
}

export function setupProgressPhotos(){
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-progress-photos]'))openPhotos();
  });
}
