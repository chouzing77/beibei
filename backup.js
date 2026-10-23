/* Portable JSON backup. Images are embedded; no server or account is needed. */
const BeibeiBackup=(()=>{
  const MAX_BYTES=100*1024*1024,MAX_IMAGE=15*1024*1024,clone=value=>JSON.parse(JSON.stringify(value));
  const kinds=new Set(['image/png','image/jpeg','image/webp','image/gif']);
  let pending=null,busy=false;
  function assert(ok,message='备份格式不正确'){if(!ok)throw Error(message);}
  function id(value){return typeof value==='string'&&value.length>0&&value.length<=200&&!['__proto__','constructor','prototype'].includes(value);}
  function safe(value,depth=0){assert(depth<50,'备份层级过深');if(value&&typeof value==='object')for(const key of Object.keys(value)){assert(!['__proto__','constructor','prototype'].includes(key),'备份含不支持的字段');safe(value[key],depth+1);}}
  function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
  function hash(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16);}
  function validateDays(days){assert(days&&typeof days==='object'&&!Array.isArray(days));assert(Object.keys(days).length<=50000);for(const [key,day] of Object.entries(days)){assert(/^\d{4}-\d{2}-\d{2}$/.test(key));for(const metric of ['reviews','focusMs','sessions'])assert(Number.isFinite(day[metric])&&day[metric]>=0&&day[metric]<=Number.MAX_SAFE_INTEGER);}}
  function validate(pack){
    safe(pack);assert(pack?.format==='beibei-backup','请选择“导出备份”生成的文件；普通题库请用文件夹里的“导入”');assert(pack.version===1,'此备份版本暂不支持，请更新背背');
    const data=pack.data;assert(data&&Array.isArray(data.folders)&&Array.isArray(data.decks)&&Array.isArray(pack.images));assert(data.decks.length<=20000&&data.folders.length<=2000&&pack.images.length<=10000,'备份内容过多');
    const folders=new Set(),cards=new Set(),images=new Set();let imageBytes=0;
    for(const folder of data.folders){assert(id(folder.id)&&!folders.has(folder.id));folders.add(folder.id);assert(typeof folder.name==='string'&&folder.name.length<=1000);if(folder.colorIndex!==undefined)assert(Number.isInteger(folder.colorIndex)&&folder.colorIndex>=0&&folder.colorIndex<15);}
    for(const item of pack.images){assert(id(item.id)&&!images.has(item.id));images.add(item.id);assert(kinds.has(item.type),'备份含不支持的图片类型');assert(typeof item.base64==='string'&&item.base64.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64));const size=item.base64.length*3/4-(item.base64.endsWith('==')?2:item.base64.endsWith('=')?1:0);assert(size>0&&size<=MAX_IMAGE,'单张图片超过 15 MB');imageBytes+=size;}
    assert(imageBytes<=MAX_BYTES,'图片总量超过 100 MB');
    for(const deck of data.decks){
      assert(id(deck.id)&&!cards.has(deck.id)&&folders.has(deck.folderId));cards.add(deck.id);assert(typeof deck.title==='string'&&typeof deck.originalText==='string');assert(Array.isArray(deck.blocks)&&deck.blocks.length<=5000&&Array.isArray(deck.connections));
      const blocks=new Set();for(const block of deck.blocks){assert(id(block.id)&&!blocks.has(block.id));blocks.add(block.id);for(const key of ['cue','text','summary','quote'])if(block[key]!==undefined)assert(typeof block[key]==='string');if(block.colorIndex!==undefined)assert(Number.isInteger(block.colorIndex)&&block.colorIndex>=0&&block.colorIndex<15);if(block.start!==undefined)assert(Number.isInteger(block.start)&&block.start>=0);if(block.layout){const l=block.layout;assert(['rect','ellipse','circle','triangle'].includes(l.shape));for(const k of ['x','y','w','h'])assert(Number.isFinite(l[k])&&l[k]>=0&&l[k]<=100000);assert(l.w>=145&&l.w<=960&&l.h>=120&&l.x+l.w<=960);}}
      for(const link of deck.connections)assert(id(link.id)&&blocks.has(link.from)&&blocks.has(link.to)&&(!link.label||typeof link.label==='string'));
      assert(!deck.answerImages||Array.isArray(deck.answerImages));for(const image of deck.answerImages||[])assert(images.has(image.id),'备份缺少图片，已取消导入');
      const review=deck.review;if(review){assert(Array.isArray(review.history));for(const event of review.history)assert(Number.isFinite(event.at)&&['hard','good','easy'].includes(event.rating));for(const k of ['dueAt','intervalDays','streak'])if(review[k]!==undefined)assert(Number.isFinite(review[k])&&review[k]>=0);}
    }
    assert(data.study&&data.study.sources);validateDays(data.study.days);assert(Object.keys(data.study.sources).length<=10000);for(const [key,days] of Object.entries(data.study.sources)){assert(id(key));validateDays(days);}
    const timer=data.study.timer;assert(timer&&['idle','paused','complete'].includes(timer.status),'备份中的专注计时器必须暂停');assert(Number.isFinite(timer.durationMs)&&timer.durationMs>=60000&&timer.durationMs<=10800000);assert(Number.isFinite(timer.remainingMs)&&timer.remainingMs>=0&&timer.remainingMs<=timer.durationMs&&timer.startedAt===null);
    StudyCore.rebuild(data.study);if(!cards.has(data.currentId))data.currentId=data.decks[0]?.id||null;return pack;
  }
  async function toBase64(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
  function fromBase64(image){const bytes=atob(image.base64);return new Blob([Uint8Array.from(bytes,c=>c.charCodeAt(0))],{type:image.type});}
  async function exportData(){
    const data=clone(state);StudyCore.ensureSources(data.study);StudyCore.settle(data.study,Date.now());if(data.study.timer.status==='running'){data.study.timer.status='paused';data.study.timer.startedAt=null;}
    // Persist the lineage before download so repeated exports retain the same IDs.
    localStorage.setItem(KEY,JSON.stringify(state));
    const images=[];for(const imageId of new Set(data.decks.flatMap(d=>(d.answerImages||[]).map(i=>i.id)))){const blob=await AnswerImages.get(imageId);assert(blob,'有图片无法读取，备份未生成');assert(blob.size<=MAX_IMAGE&&kinds.has(blob.type),'存在不支持的图片');images.push({id:imageId,type:blob.type,base64:await toBase64(blob)});}
    const pack={format:'beibei-backup',version:1,exportedAt:new Date().toISOString(),data,images};validate(pack);assert(new Blob([JSON.stringify(pack)]).size<=MAX_BYTES,'备份超过 100 MB，请减少图片后重试');return pack;
  }
  async function readFile(file){assert(file&&file.size<=MAX_BYTES,'请选择 100 MB 以内的备份');let pack;try{pack=JSON.parse(await file.text());}catch{throw Error('文件损坏或不是 JSON 备份');}return validate(pack);}
  const history=review=>review?.history||[];
  function content(deck){const copy=clone(deck);for(const key of ['id','updatedAt','createdAt','review','backupConflictOf'])delete copy[key];return stable(copy);}
  function mergeData(local,incoming){
    const result=clone(local),folderMap=new Map();let conflicts=0;
    for(const folder of incoming.folders){const old=result.folders.find(f=>f.id===folder.id);if(!old)result.folders.push(clone(folder));else if(stable(old)!==stable(folder)){const copy={...clone(folder),id:`import-${hash(stable(folder))}-${folder.id}`.slice(0,190)};if(!result.folders.some(f=>f.id===copy.id))result.folders.push(copy);folderMap.set(folder.id,copy.id);}}
    for(const deck of incoming.decks){const copy=clone(deck);copy.folderId=folderMap.get(copy.folderId)||copy.folderId;const old=result.decks.find(d=>d.id===copy.id);
      if(!old){result.decks.push(copy);continue;}
      if(content(old)===content(copy)){
        const events=[...history(old.review),...history(copy.review)],unique=new Map(events.map(e=>[e.id||`${e.at}:${e.rating}`,e]));
        const oldLast=Math.max(0,...history(old.review).map(e=>e.at)),newLast=Math.max(0,...history(copy.review).map(e=>e.at));
        old.review=clone(newLast>oldLast?copy.review:old.review||copy.review||{dueAt:0,history:[]});old.review.history=[...unique.values()].sort((a,b)=>a.at-b.at).slice(-60);
      }else{const conflictId=`conflict-${hash(content(copy))}-${copy.id}`.slice(0,190);if(!result.decks.some(d=>d.id===conflictId)){copy.backupConflictOf=copy.id;copy.id=conflictId;copy.title+='（导入副本）';result.decks.push(copy);conflicts++;}}
    }
    StudyCore.ensureSources(result.study);for(const [origin,days] of Object.entries(incoming.study.sources)){const target=result.study.sources[origin] ||= {};for(const [key,entry] of Object.entries(days)){target[key] ||= {reviews:0,focusMs:0,sessions:0};for(const metric of ['reviews','focusMs','sessions'])target[key][metric]=Math.max(target[key][metric],entry[metric]);}}
    StudyCore.rebuild(result.study);return {data:result,conflicts};
  }
  async function restore(pack,mode){
    validate(pack);assert(['merge','replace'].includes(mode));const previous=await exportData();pack=clone(pack);let next,conflicts=0;
    // Normalize colliding blob IDs BEFORE comparing cards, so different images become a conflict copy.
    for(const item of pack.images){const existing=previous.images.find(i=>i.id===item.id);if(existing&&(existing.base64!==item.base64||existing.type!==item.type)){const oldId=item.id;item.id=`image-${hash(item.type+item.base64)}-${oldId}`.slice(0,190);for(const deck of pack.data.decks)for(const img of deck.answerImages||[])if(img.id===oldId)img.id=item.id;}}
    if(mode==='merge')({data:next,conflicts}=mergeData(previous.data,pack.data));else next=clone(pack.data);
    // Rollback snapshot includes blobs, so later edits/deletes cannot invalidate it.
    await AnswerImages.recovery(previous);
    const added=[],remap=new Map();
    try{
      for(const item of pack.images){const existing=await AnswerImages.get(item.id);if(existing&&existing.type===item.type&&await toBase64(existing)===item.base64)continue;const fresh=existing?uid():item.id;await AnswerImages.put(fresh,fromBase64(item));added.push(fresh);remap.set(item.id,fresh);}
      // Remap only incoming/new records; existing local references remain intact.
      for(const deck of next.decks){const local=previous.data.decks.find(d=>d.id===deck.id);if(mode==='replace'||!local)for(const img of deck.answerImages||[])img.id=remap.get(img.id)||img.id;}
      localStorage.setItem(KEY,JSON.stringify(next));
    }catch(error){for(const imageId of added)await AnswerImages.remove(imageId).catch(()=>{});throw Error('未能保存备份，现有资料保持不变。请检查存储空间。');}
    state=next;activeFolderId=null;firstShown.clear();secondLevel.clear();reviewQueue=[];reviewIndex=0;selectedNodeId=null;selectedConnectionId=null;renderDeckSelect();setView('folders');window.StudyUI?.renderFocus();
    return {conflicts};
  }
  async function download(pack){
    const name=`背背备份-${StudyCore.dayKey(Date.now())}.json`,text=JSON.stringify(pack);
    if(window.NativeFiles){await window.NativeFiles.save(new Blob([text],{type:'application/json'}),name);return;}
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function status(text){$('#backup-status').textContent=text;}
  async function run(fn){if(busy)return;busy=true;$$('#backup-dialog button,#backup-dialog input,#backup-dialog select').forEach(b=>b.disabled=true);try{await fn();}catch(error){status(error.message||'操作失败');}finally{busy=false;$$('#backup-dialog button,#backup-dialog input,#backup-dialog select').forEach(b=>b.disabled=false);$('#backup-apply').disabled=!pending;}}
  function preview(pack){pending=pack;$('#backup-preview').textContent=`${pack.data.folders.length} 个文件夹 · ${pack.data.decks.length} 张卡片 · ${pack.images.length} 张图片`;$('#backup-apply').disabled=false;}
  document.body.insertAdjacentHTML('beforeend',`<dialog id="backup-dialog" class="properties-dialog" aria-labelledby="backup-title"><div class="dialog-heading"><h2 id="backup-title">备份与恢复</h2><button id="backup-close" class="quiet-button" type="button" aria-label="关闭">×</button></div><button id="backup-export" class="button button-dark" type="button">导出完整备份</button><p class="backup-note">包含图片、积木和学习进度。换设备后导入即可继续；专注计时器会暂停。</p><label class="backup-file">导入备份<input id="backup-file" type="file" accept=".json,application/json"></label><p id="backup-preview"></p><label>导入方式<select id="backup-mode"><option value="merge">合并 · 不同内容保留副本</option><option value="replace">恢复整个备份 · 替换当前资料</option></select></label><p id="backup-status" role="status" aria-live="polite"></p><div class="dialog-actions"><button id="backup-recovery" class="small-button" type="button">找回上次导入前资料</button><button id="backup-apply" class="button button-dark" type="button" disabled>导入</button></div></dialog><dialog id="backup-confirm" class="properties-dialog" aria-labelledby="backup-confirm-title"><h2 id="backup-confirm-title">替换当前全部资料？</h2><p>当前资料将保留一份本机回退副本。</p><div class="dialog-actions"><button id="backup-confirm-cancel" class="small-button" type="button">取消</button><button id="backup-confirm-apply" class="button button-danger" type="button">替换并恢复</button></div></dialog>`);
  const button=document.createElement('button');button.type='button';button.className='text-button';button.id='backup-open';button.textContent='备份';$('.directory-header nav').append(button);
  button.onclick=()=>{$('#backup-dialog').showModal();};$('#backup-close').onclick=()=>$('#backup-dialog').close();$('#backup-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('#backup-export').onclick=()=>run(async()=>{status('正在打包…');await download(await exportData());status('备份已导出');});
  $('#backup-file').onchange=()=>run(async()=>{pending=null;status('正在读取…');preview(await readFile($('#backup-file').files[0]));status('已检查，可以导入');$('#backup-file').value='';});
  const apply=()=>run(async()=>{status('正在恢复…');const result=await restore(pending,$('#backup-mode').value);pending=null;status(result.conflicts?`导入完成，保留 ${result.conflicts} 张不同版本副本`:'导入完成');});
  $('#backup-apply').onclick=()=>{if($('#backup-mode').value==='replace')$('#backup-confirm').showModal();else apply();};
  $('#backup-confirm-cancel').onclick=()=>$('#backup-confirm').close();$('#backup-confirm-apply').onclick=()=>{$('#backup-confirm').close();apply();};
  $('#backup-recovery').onclick=()=>run(async()=>{const pack=await AnswerImages.recovery();assert(pack,'暂无回退副本');preview(validate(pack));$('#backup-mode').value='replace';status('已载入上次导入前的资料，点击导入后确认恢复');});
  return {exportData,readFile,validate,mergeData,restore,toBase64,MAX_BYTES};
})();
