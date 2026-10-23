const KEY='beishu-blocks-v1';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const uid=()=>globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clean=value=>String(value??'').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sampleText='担保物权是为了担保债权的实现，由债务人或者第三人以动产、不动产或者某些权利为客体而设定的。当债务人不履行到期债务，或者发生当事人约定的实现担保物权的情形时，债权人可以就担保财产变价并优先受偿。担保物权是一种限制物权。';
const sampleQuotes=['为了担保债权的实现','债务人或者第三人','动产、不动产或者某些权利','当债务人不履行到期债务，或者发生当事人约定的实现担保物权的情形时','债权人可以就担保财产变价并优先受偿','限制物权'];
const starter={id:'sample-danbao',folderId:'folder-default',title:'担保物权',originalText:sampleText,lastSplitText:sampleText,blocks:[
  {id:'b1',cue:'目的',text:'为了担保债权的实现',summary:'担保债权实现',meaning:'设立原因',quote:sampleQuotes[0],colorIndex:0},
  {id:'b2',cue:'主体',text:'债务人或者第三人',summary:'提供担保的人',meaning:'谁提供担保',quote:sampleQuotes[1],colorIndex:1},
  {id:'b3',cue:'客体',text:'动产、不动产或者某些权利',summary:'用于担保的财产或权利',meaning:'拿什么作担保',quote:sampleQuotes[2],colorIndex:2},
  {id:'b4',cue:'实现情形',text:'债务人不履行到期债务，或者发生约定的情形',summary:'未履行债务或发生约定情形',meaning:'何时可以实现',quote:sampleQuotes[3],colorIndex:3},
  {id:'b5',cue:'权能',text:'就担保财产变价并优先受偿',summary:'变价并优先受偿',meaning:'债权人能做什么',quote:sampleQuotes[4],colorIndex:4},
  {id:'b6',cue:'属性',text:'一种限制物权',summary:'限制物权',meaning:'概念归类',quote:sampleQuotes[5],colorIndex:5}
],connections:[{from:'b2',to:'b3'},{from:'b4',to:'b5'}],weakBlockIds:[],review:{dueAt:Date.now(),intervalDays:0,streak:0,lastRating:null,history:[]},createdAt:Date.now(),updatedAt:Date.now()};
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{state=null;}
if(!state||!Array.isArray(state.decks))state={decks:[starter],currentId:starter.id};
if(!Array.isArray(state.folders))state.folders=[{id:'folder-default',name:'我的背书'}];
if(state.decks.length&&!state.folders.length)state.folders=[{id:'folder-default',name:'我的背书'}];
state.decks.forEach(deck=>{
  deck.folderId ||=state.folders[0].id;deck.blocks ||= [];deck.connections ||= [];deck.connections.forEach(link=>link.id ||=uid());
  if(deck.id==='sample-danbao'&&deck.originalText===sampleText)deck.blocks.forEach((block,index)=>{block.summary ||=starter.blocks[index]?.summary||short(block.text,22);block.quote ||=starter.blocks[index]?.quote;block.colorIndex ??=index%15;});
});
let activeFolderId=null;
state.study ||= StudyCore.create(state.decks);
StudyCore.ensureSources(state.study);
let activeView='folders';
let activeStage='source';
let firstShown=new Set();
let secondLevel=new Map();
let lastFlippedId=null;
let reviewFlipped=false;
let selectedNodeId=null;
let selectedConnectionId=null;
let editingFolderId=null;
let folderColor=5;
let arrowStartId=null;
let arrowMode=false;
let paintMode=false;
let paintColor=0;
let importRows=[];
let importColumns=[];
let importDeckName='';
let importDeckColumn=-1;
let importWorkbook=null;
let toastTimer;
let pendingDeleteCardId=null;
let draftAnswerImages=[];
let imageUploadBusy=false;
let imageDraftGeneration=0;
let reviewQueue=[];
let reviewIndex=0;
let reviewDone=new Set();
const imageUrls=new WeakMap();

function hasAnswer(deck){return !!(clean(deck.originalText)||deck.blocks?.length||deck.answerImages?.length);}
function current(){return state.decks.find(deck=>deck.id===state.currentId)||state.decks[0];}
function activeFolder(){return state.folders.find(folder=>folder.id===activeFolderId)||null;}
function persist(){
  const deck=current();if(deck)deck.updatedAt=Date.now();
  try{localStorage.setItem(KEY,JSON.stringify(state));$('#saved-state').textContent='已保存';}
  catch{$('#saved-state').textContent='未保存';toast('浏览器无法保存');return false;}
  clearTimeout(persist.timer);persist.timer=setTimeout(()=>$('#saved-state').textContent='',1700);
  return true;
}
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2200);}
function fmtDue(time){const diff=(time||0)-Date.now();if(diff<=0)return '现在';if(diff<2*3600000)return `${Math.ceil(diff/60000)} 分钟后`;if(diff<86400000)return `${Math.ceil(diff/3600000)} 小时后`;return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(time));}
function setView(view){
  if(view==='folders'){imageDraftGeneration++;discardUnusedDraftImages();}
  if(['understand','review'].includes(view)&&!activeFolderId){toast('先进入文件夹');return;}
  if(['understand','review'].includes(view)&&!state.decks.some(deck=>deck.folderId===activeFolderId)){toast('先新建或导入卡片');return;}
  activeView=view;
  document.body.classList.toggle('directory-mode',view==='folders');
  document.body.classList.toggle('study-mode',['stats','focus'].includes(view));
  if(view!=='folders')$('#import-panel').hidden=true;
  $$('.view').forEach(node=>node.classList.toggle('active',node.id===`view-${view}`));
  $$('.step').forEach(node=>{const on=node.dataset.view===view;node.classList.toggle('active',on);node.setAttribute('aria-current',on?'step':'false');});
  if(view==='folders')renderFolders();
  if(view==='understand'){renderUnderstand();setStage(activeStage);}
  if(view==='review'){startReviewSession();}
  if(view==='stats')window.StudyUI?.renderStats();
  if(view==='focus')window.StudyUI?.renderFocus();
  window.scrollTo({top:0,behavior:'smooth'});
}
function setStage(stage){
  activeStage=stage;
  for(const name of ['source','first','second'])$(`#understand-${name}`).hidden=name!==stage;
  $('#stage-name').textContent=({source:'原文',first:'一阶',second:'二阶'})[stage];
  if(stage==='first')renderFirst();
  if(stage==='second')renderSecond();
  if(stage==='source'){if(!current().sourceConfirmed)openEditor(true);else{openEditor(false);togglePaint();}}
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderDeckSelect(){
  const select=$('#deck-select');select.replaceChildren();
  state.decks.filter(deck=>!activeFolderId||deck.folderId===activeFolderId).forEach(deck=>{const option=document.createElement('option');option.value=deck.id;option.textContent=deck.title||'未命名卡片';select.append(option);});
  if(![...select.options].some(option=>option.value===state.currentId)){const first=select.options[0];if(first)state.currentId=first.value;}
  select.value=state.currentId;
  $('#due-dot').hidden=!state.decks.some(deck=>hasAnswer(deck)&&(deck.review?.dueAt||0)<=Date.now());
}
function chooseDeck(id,view){const deck=state.decks.find(item=>item.id===id);if(!deck)return;state.currentId=id;activeFolderId=deck.folderId;firstShown=new Set();secondLevel=new Map();selectedNodeId=null;activeStage='source';persist();renderDeckSelect();setView(view);}
function renderFolders(){
  const folder=activeFolder();$('#folder-title').textContent=folder?.name||'文件夹';
  $('#folder-list').hidden=!!folder;$('#folder-detail').hidden=!folder;
  const list=$('#folder-list');list.replaceChildren();
  state.folders.forEach(item=>{const decks=state.decks.filter(deck=>deck.folderId===item.id);const due=decks.filter(deck=>hasAnswer(deck)&&(deck.review?.dueAt||0)<=Date.now()).length;
    const card=document.createElement('article');card.className=`folder-tile line-${Number(item.colorIndex??5)%15}`;
    card.innerHTML=`<button type="button" class="folder-card" data-folder-open="${esc(item.id)}"><span class="folder-icon">▱</span><strong>${esc(item.name)}</strong><span>${decks.length} 张卡片</span>${item.description?`<small>${esc(item.description)}</small>`:''}</button><div class="folder-controls"><button type="button" data-folder-rename="${esc(item.id)}" class="quiet-button">属性</button><button type="button" data-folder-delete="${esc(item.id)}" class="quiet-button">删除</button></div>`;list.append(card);
  });
  const cards=$('#folder-decks');cards.replaceChildren();
  if(folder){state.decks.filter(deck=>deck.folderId===folder.id).forEach(deck=>{const row=document.createElement('article');row.className='folder-deck';row.innerHTML=`<div><strong>${esc(deck.title||'未命名卡片')}</strong><span>${deck.blocks.length} 块 · ${fmtDue(deck.review?.dueAt)}复习</span></div><div><button class="quiet-button" data-deck-edit="${esc(deck.id)}" type="button">编辑</button><button class="quiet-button" data-deck-delete="${esc(deck.id)}" type="button">删除</button><button class="small-button" data-deck-open="${esc(deck.id)}" type="button">理解</button><button class="button button-dark" data-deck-review="${esc(deck.id)}" type="button">复习 ↗</button></div>`;cards.append(row);});}
  renderDeckSelect();
}
function newFolder(name){name=clean(name);if(!name)return null;let found=state.folders.find(folder=>folder.name===name);if(found)return found;found={id:uid(),name};state.folders.push(found);persist();return found;}
function renderFolderColors(){
  $('#folder-color-options').innerHTML=Array.from({length:15},(_,index)=>`<button type="button" class="paint-swatch line-${index}${folderColor===index?' active':''}" data-folder-color="${index}" aria-label="文件夹颜色 ${index+1}" aria-pressed="${folderColor===index}"></button>`).join('');
}
function openFolderProperties(id=null){
  editingFolderId=id;const folder=state.folders.find(item=>item.id===id);folderColor=folder?.colorIndex??5;
  $('#folder-properties-title').textContent=folder?'文件夹属性':'新建文件夹';$('#folder-name').value=folder?.name||'';$('#folder-description').value=folder?.description||'';$('#folder-properties-error').textContent='';renderFolderColors();$('#folder-properties').showModal();$('#folder-name').focus();
}
function removeSemanticBrick(id){
  const deck=current();deck.blocks=deck.blocks.filter(block=>block.id!==id);deck.connections=deck.connections.filter(link=>link.from!==id&&link.to!==id);firstShown.delete(id);secondLevel.delete(id);if(selectedNodeId===id)selectedNodeId=null;persist();renderUnderstand();
}
function newDeck(){
  const folder=activeFolder()||state.folders[0],id=uid();
  if(!folder){toast('先新建文件夹');return;}
  state.decks.push({id,folderId:folder.id,title:'新卡片',originalText:'',lastSplitText:'',blocks:[],connections:[],review:{dueAt:Date.now(),intervalDays:0,streak:0,lastRating:null,history:[]},createdAt:Date.now(),updatedAt:Date.now()});
  state.currentId=id;activeFolderId=folder.id;firstShown=new Set();secondLevel=new Map();activeStage='source';persist();setView('understand');openEditor(true);$('#source-text').focus();
}
function parseDelimited(text,separator){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(char===separator&&!quoted){row.push(field);field='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(cell=>clean(cell)))rows.push(row);row=[];field='';}
    else field+=char;
  }
  row.push(field);if(row.some(cell=>clean(cell)))rows.push(row);return rows;
}
function prepareImport(text,filename){
  importDeckName='';importDeckColumn=-1;importRows=[];importColumns=[];
  if(filename.toLowerCase().endsWith('.json')){
    const parsed=JSON.parse(text);const items=Array.isArray(parsed)?parsed:parsed.cards||parsed.decks||[];
    importRows=items.map(item=>[clean(item.front||item.title||item.question),clean(item.back||item.originalText||item.answer),clean(item.folder||item.deck)]).filter(row=>row[0]||row[1]);
    importColumns=['正面','背面','文件夹'];
  }else{
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);const headers={};
    while(lines[0]?.startsWith('#')){const match=lines.shift().match(/^#([^:]+):(.*)$/);if(match)headers[match[1].trim().toLowerCase()]=match[2].trim();}
    importDeckName=headers.deck||'';
    const first=lines.find(line=>clean(line))||'';
    const named={tab:'\t',comma:',',semicolon:';',pipe:'|',colon:':',space:' '};
    const separator=named[(headers.separator||'').toLowerCase()]||headers.separator||(['\t',',',';','|'].sort((a,b)=>first.split(b).length-first.split(a).length)[0]);
    const sep=separator&&first.includes(separator)?separator:null;
    importRows=sep?parseDelimited(lines.join('\n'),sep):lines.filter(line=>clean(line)).map(line=>[line,'']);
    importColumns=headers.columns?(sep?parseDelimited(headers.columns,sep)[0]:[headers.columns]):[];
    if(!importColumns.length&&isHeaderRow(importRows[0]))importColumns=importRows.shift().map(clean);
    if(!importColumns.length)importColumns=Array.from({length:Math.max(2,...importRows.map(row=>row.length))},(_,index)=>`第 ${index+1} 列`);
    if(headers['deck column']){const column=Number(headers['deck column'])-1;if(column>=0&&column<importColumns.length)importDeckColumn=column;}
  }
  renderImportMapping();
}
function isHeaderRow(row){return row?.length>=2&&/^(front|question|正面|问题|题目)$/i.test(clean(row[0]))&&/^(back|answer|背面|答案)$/i.test(clean(row[1]));}
function readImportSheet(){
  importDeckName='';importDeckColumn=-1;
  const sheet=importWorkbook.Sheets[$('#import-sheet').value];
  importRows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false}).map(row=>row.map(clean));
  importColumns=isHeaderRow(importRows[0])?importRows.shift():['问题','答案'];
  const width=Math.max(2,...importRows.map(row=>row.length));
  while(importColumns.length<width)importColumns.push(`第 ${importColumns.length+1} 列`);
  renderImportMapping();
}
function renderImportMapping(){
  for(const [id,none] of [['import-front',false],['import-back',false],['import-folder-column',true]]){
    const select=$(`#${id}`);select.replaceChildren();if(none){const option=document.createElement('option');option.value='-1';option.textContent='无';select.append(option);}
    importColumns.forEach((column,index)=>{const option=document.createElement('option');option.value=index;option.textContent=column;select.append(option);});
  }
  const lower=importColumns.map(column=>column.toLowerCase());
  $('#import-front').value=String(Math.max(0,lower.findIndex(value=>/front|正面|question|题目|问题/.test(value))));
  const backIndex=lower.findIndex(value=>/back|背面|answer|答案/.test(value));
  $('#import-back').value=String(backIndex>=0?backIndex:importColumns.length>1?1:0);
  $('#import-folder-column').value=String(importDeckColumn>=0?importDeckColumn:lower.findIndex(value=>/deck|folder|牌组|文件夹/.test(value)));
  renderImportPreview();
}
function renderImportPreview(){
  const front=Number($('#import-front').value),back=Number($('#import-back').value),folder=Number($('#import-folder-column').value);
  const valid=front!==back?importRows.filter(row=>clean(row[front])&&clean(row[back])).length:0;
  $('#import-count').textContent=front===back?'问题和答案请选择不同列':`${valid} 张可导入${valid<importRows.length?` · ${importRows.length-valid} 行缺少问题或答案`:''}`;
  $('#import-confirm').disabled=!valid;
  $('#import-preview').innerHTML=importRows.slice(0,4).map(row=>`<div><b>${esc(row[front]||'未命名')}</b><span>${esc(row[back]||'')}</span><small>${esc(row[folder]||importDeckName||'')}</small></div>`).join('');
}
function commitImport(){
  if(!importRows.length){toast('先选择文件');return;}
  const front=Number($('#import-front').value),back=Number($('#import-back').value),folderColumn=Number($('#import-folder-column').value);
  if(front===back){toast('问题和答案请选择不同列');return;}
  let added=0,firstId=null;
  importRows.forEach(row=>{const title=clean(row[front]),body=clean(row[back]);if(!title||!body)return;
    const folderName=clean(row[folderColumn]||importDeckName);const folder=folderName?newFolder(folderName):activeFolder()||state.folders[0];
    if(state.decks.some(deck=>deck.folderId===folder.id&&deck.title===title&&deck.originalText===body))return;
    const id=uid();state.decks.push({id,folderId:folder.id,title:title||body.slice(0,18),originalText:body,lastSplitText:'',blocks:[],connections:[],imported:true,sourceConfirmed:false,review:{dueAt:Date.now(),intervalDays:0,streak:0,lastRating:null,history:[]},createdAt:Date.now(),updatedAt:Date.now()});
    firstId ||=id;added++;
  });
  if(firstId){state.currentId=firstId;activeFolderId=state.decks.find(deck=>deck.id===firstId).folderId;}persist();$('#import-panel').hidden=true;renderFolders();toast(`导入 ${added} 张卡片`);
}

function short(text,max=30){const value=clean(text);return value.length>max?`${value.slice(0,max)}…`:value;}
function guessCue(text,index){if(/为了|目的是|旨在|以便/.test(text))return '目的';if(/当|如果|若|在.*时/.test(text))return '条件';if(/因此|所以|从而|结果/.test(text))return '结果';if(/由[^，。；]+(?:负责|提出|完成|实施|提供)/.test(text))return '主体';if(/以[^，。；]+为(?:对象|客体|基础|依据)/.test(text))return '对象';if(/包括|分为|由.*组成/.test(text))return '组成';if(/是指|是.*一种|称为/.test(text))return '定义';return `要点 ${index+1}`;}
function guessMeaning(text){if(/为了|目的是|旨在|以便/.test(text))return '目的';if(/当|如果|若/.test(text))return '条件';if(/因此|所以|从而/.test(text))return '结果';if(/包括|分为|组成/.test(text))return '组成';if(/是指|称为/.test(text))return '定义';return '';}
function splitText(text){
  const source=clean(text);if(!source)return [];
  let parts=source.split(/(?<=[。！？；;])\s*|(?<=[，,])\s*(?=[^，,。！？；;]{6,})/u).map(clean).filter(Boolean);
  if(parts.length===1&&source.length>65)parts=source.match(/.{1,30}(?:[，,。！？；;]|$)/gu)||[source];
  let cursor=0;return parts.slice(0,18).map((part,index)=>{const quote=part.replace(/[，,。！？；;]$/u,'');const start=source.indexOf(quote,cursor);cursor=Math.max(cursor,start+quote.length);return{id:uid(),cue:guessCue(part,index),summary:short(quote,22),meaning:guessMeaning(part),text:quote,quote,start,colorIndex:index%15};});
}
function blockRanges(deck){
  const source=deck.originalText||'';let cursor=0;const ranges=[];
  deck.blocks.forEach((block,index)=>{
    const quote=block.quote||(deck.id==='sample-danbao'?sampleQuotes[index]:null)||block.text||'';
    let start=Number.isInteger(block.start)&&source.slice(block.start,block.start+quote.length)===quote?block.start:source.indexOf(quote,cursor);
    if(start<0)start=source.indexOf(quote);
    if(start>=0&&quote){ranges.push({start,end:start+quote.length,block,index});cursor=Math.max(cursor,start+quote.length);}
  });
  return ranges.sort((a,b)=>a.start-b.start).filter((item,index,array)=>!index||item.start>=array[index-1].end);
}
function renderAnnotated(){
  const deck=current(),source=deck.originalText||'',holder=$('#annotated-text');holder.replaceChildren();
  if(!source){holder.innerHTML='<span class="empty-source">粘贴要背的文字</span>';return;}
  let cursor=0;blockRanges(deck).forEach(({start,end,block,index})=>{
    holder.append(document.createTextNode(source.slice(cursor,start)));
    const line=document.createElement('span');line.className=`structure-line line-${(block.colorIndex??index)%15}`;line.tabIndex=0;line.setAttribute('aria-label',`${block.cue}：${block.summary||block.text}`);
    line.textContent=source.slice(start,end);
    const tip=document.createElement('span');tip.className='line-tip';tip.innerHTML=`<b>${esc(block.cue)}</b><span>${esc(block.summary||block.text)}</span>`;line.append(tip);holder.append(line);cursor=end;
  });holder.append(document.createTextNode(source.slice(cursor)));
}
function renderPaintColors(){const holder=$('#paint-colors');holder.replaceChildren();for(let index=0;index<15;index++){const button=document.createElement('button');button.type='button';button.className=`paint-swatch line-${index}${paintColor===index?' active':''}`;button.dataset.paintColor=index;button.setAttribute('aria-label',`画笔颜色 ${index+1}`);button.setAttribute('aria-pressed',String(paintColor===index));holder.append(button);}}
function renderUnderstand(){
  const deck=current();
  if(!deck)return;
  renderAnswerImages($('#source-answer-images'),deck.answerImages||[],false);
  $('#include-first').checked=deck.studyOptions?.first!==false;$('#include-second').checked=deck.studyOptions?.second!==false;
  $('#source-text').value=deck.originalText||'';$('#source-count').textContent=`${(deck.originalText||'').length} 字`;$('#block-count').textContent=`${deck.blocks.length} 块`;
  renderPaintSurface();renderPaintColors();renderAnnotated();renderSemanticBricks();
  const holder=$('#blocks-editor');holder.replaceChildren();
  deck.blocks.forEach((block,index)=>{const card=document.createElement('div');card.className=`block-editor line-${(block.colorIndex??index)%15}`;card.dataset.id=block.id;
    card.innerHTML=`<span class="block-index">${String(index+1).padStart(2,'0')}</span><div class="block-fields"><input class="cue-input" aria-label="第 ${index+1} 块线索" placeholder="线索" value="${esc(block.cue)}"><input class="summary-input" aria-label="第 ${index+1} 块短归纳" placeholder="短归纳" value="${esc(block.summary||short(block.text,22))}"><textarea class="text-input" aria-label="第 ${index+1} 块原文" placeholder="原文内容">${esc(block.text)}</textarea></div><button class="remove-block" type="button" aria-label="删除第 ${index+1} 块">×</button>`;holder.append(card);
  });renderDeckSelect();
}
function openEditor(open){if(open){discardUnusedDraftImages();imageDraftGeneration++;draftAnswerImages=(current().answerImages||[]).map(image=>({...image}));renderAnswerImages($('#answer-image-drafts'),draftAnswerImages,true);$('#source-title').value=current().title||'';$('#source-text').value=current().originalText||'';}$('#source-editor').hidden=!open;$('#semantic-bricks').hidden=open;$('#source-actions').hidden=open;$('#annotated-text').hidden=open;$('#paint-panel').hidden=true;paintMode=false;$('#paint-mode-toggle').classList.remove('active');$('#edit-source').textContent='编辑';$('#stage-name').textContent=open?'确认原文':'一阶 · 划分意群';$('.source-advanced').hidden=!current().sourceConfirmed;}
function togglePaint(){if(!current().sourceConfirmed){openEditor(true);return;}paintMode=!paintMode;renderPaintSurface();$('#paint-panel').hidden=!paintMode;$('#annotated-text').hidden=paintMode;$('#source-editor').hidden=true;$('#semantic-bricks').hidden=false;$('#source-actions').hidden=false;$('#edit-source').textContent='编辑';$('#paint-mode-toggle').classList.toggle('active',paintMode);}
function confirmSource(understand=true){
  const deck=current(),title=clean($('#source-title').value),text=clean($('#source-text').value);
  if(imageUploadBusy){toast('图片正在保存');return;}
  if(!title||(!text&&!draftAnswerImages.length)){toast('请填写问题，并添加文字或图片答案');return;}
  const previous=structuredClone(deck);
  if(text!==deck.originalText){
    let cursor=0;deck.blocks=deck.blocks.filter(block=>{const quote=block.quote||block.text;let start=text.indexOf(quote,cursor);if(start<0)start=text.indexOf(quote);if(!quote||start<0)return false;block.start=start;cursor=start+quote.length;return true;});
    const ids=new Set(deck.blocks.map(block=>block.id));deck.connections=deck.connections.filter(link=>ids.has(link.from)&&ids.has(link.to));resetLearning();
  }
  const removed=(deck.answerImages||[]).filter(image=>!draftAnswerImages.some(item=>item.id===image.id));
  deck.title=title;deck.originalText=text;deck.answerImages=draftAnswerImages.map(image=>({...image}));deck.sourceConfirmed=true;deck.review ||= {dueAt:Date.now(),intervalDays:0,streak:0,history:[]};
  if(!persist()){Object.keys(deck).forEach(key=>delete deck[key]);Object.assign(deck,previous);return;}
  removed.forEach(image=>AnswerImages.remove(image.id).catch(()=>{}));
  if(!understand){setView('folders');toast('已保存，已加入复习');return;}
  renderUnderstand();openEditor(false);togglePaint();$('#stage-name').textContent='一阶 · 划分意群';
}
function releaseImageUrls(holder){if(!holder)return;(imageUrls.get(holder)||[]).forEach(url=>URL.revokeObjectURL(url));imageUrls.delete(holder);}
function discardUnusedDraftImages(){const saved=new Set(state.decks.flatMap(deck=>(deck.answerImages||[]).map(image=>image.id)));draftAnswerImages.filter(image=>!saved.has(image.id)).forEach(image=>AnswerImages.remove(image.id).catch(()=>{}));}
async function renderAnswerImages(holder,images,editable){
  releaseImageUrls(holder);holder.replaceChildren();const token=uid();holder.dataset.imageRender=token;const urls=[];imageUrls.set(holder,urls);
  for(const image of images){
    const tile=document.createElement('span');tile.className='answer-image-tile';tile.textContent='加载图片…';holder.append(tile);
    try{const blob=await AnswerImages.get(image.id);if(holder.dataset.imageRender!==token||!holder.isConnected)return;if(!blob)throw Error('missing');
      const url=URL.createObjectURL(blob);urls.push(url);tile.replaceChildren();const img=document.createElement('img');img.src=url;img.alt=image.name||'答案图片';img.onerror=()=>{img.replaceWith(document.createTextNode('图片无法显示'));};tile.append(img);
    }catch{if(holder.dataset.imageRender!==token)return;tile.textContent='图片不可用，请重新上传';}
    if(editable){const remove=document.createElement('button');remove.type='button';remove.className='answer-image-remove';remove.dataset.removeAnswerImage=image.id;remove.setAttribute('aria-label','移除答案图片');remove.textContent='×';tile.append(remove);}
  }
}
async function uploadAnswerImages(files){
  if(imageUploadBusy)return;imageUploadBusy=true;const generation=imageDraftGeneration;$('#image-upload-status').textContent='保存图片…';
  try{
    for(const file of files){
      if(draftAnswerImages.length>=12){toast('每张卡片最多 12 张图片');break;}
      if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>15*1024*1024){toast('请使用 15 MB 以内的 PNG、JPG、WebP 或 GIF');continue;}
      const id=uid();await AnswerImages.put(id,file);
      if(generation!==imageDraftGeneration){await AnswerImages.remove(id);break;}
      draftAnswerImages.push({id,name:file.name});await renderAnswerImages($('#answer-image-drafts'),draftAnswerImages,true);
    }
  }catch{toast('图片未保存，请检查浏览器存储空间');}
  finally{imageUploadBusy=false;$('#image-upload-status').textContent='';$('#answer-image-file').value='';}
}
function renderPaintSurface(){
  const deck=current(),holder=$('#paint-surface'),source=deck.originalText||'';holder.replaceChildren();let cursor=0;
  blockRanges(deck).forEach(({start,end,block,index})=>{holder.append(document.createTextNode(source.slice(cursor,start)));const span=document.createElement('span');span.className=`structure-line line-${(block.colorIndex??index)%15}`;span.textContent=source.slice(start,end);holder.append(span);cursor=end;});holder.append(document.createTextNode(source.slice(cursor)));
}
function renderSemanticBricks(){
  const holder=$('#semantic-bricks');holder.replaceChildren();
  current().blocks.forEach((block,index)=>{const brick=document.createElement('article');brick.className=`semantic-brick line-${(block.colorIndex??index)%15}`;brick.innerHTML=`<button type="button" class="semantic-delete" data-delete-brick="${esc(block.id)}" aria-label="删除积木 ${esc(block.cue)}">×</button><input data-brick-name="${esc(block.id)}" aria-label="第 ${index+1} 块名称" placeholder="给积木命名" value="${esc(block.cue)}"><p>${esc(block.quote||block.text)}</p>`;holder.append(brick);});
}
function paintSelection(){
  if(!paintMode)return;const selection=window.getSelection();if(!selection||selection.isCollapsed||!$('#paint-surface').contains(selection.anchorNode)||!$('#paint-surface').contains(selection.focusNode))return;
  const text=$('#paint-surface').textContent,range=selection.getRangeAt(0),prefix=range.cloneRange();prefix.selectNodeContents($('#paint-surface'));prefix.setEnd(range.startContainer,range.startOffset);const start=prefix.toString().length,end=start+range.toString().length;
  if(end<=start||!clean(text.slice(start,end)))return;const quote=text.slice(start,end),deck=current();
  blockRanges(deck).forEach(range=>{range.block.start ??= range.start;range.block.quote ||= text.slice(range.start,range.end);});
  const exact=deck.blocks.find(block=>block.start===start&&block.quote===quote);
  if(exact)exact.colorIndex=paintColor;
  else{
    const remove=new Set(blockRanges(deck).filter(range=>range.start<end&&range.end>start).map(range=>range.block.id));
    deck.blocks=deck.blocks.filter(block=>!remove.has(block.id));
    deck.blocks.push({id:uid(),cue:`要点 ${deck.blocks.length+1}`,summary:short(quote,22),text:quote,quote,start,colorIndex:paintColor});
    deck.blocks.sort((a,b)=>(a.start??999999)-(b.start??999999));
  }
  const ids=new Set(deck.blocks.map(block=>block.id));deck.connections=deck.connections.filter(link=>ids.has(link.from)&&ids.has(link.to));firstShown=new Set();secondLevel=new Map();selection.removeAllRanges();persist();renderUnderstand();
}
function saveBlockEdit(event){const editor=event.target.closest('.block-editor');if(!editor)return;const block=current().blocks.find(item=>item.id===editor.dataset.id);if(!block)return;
  if(event.target.classList.contains('cue-input'))block.cue=event.target.value;
  if(event.target.classList.contains('summary-input'))block.summary=event.target.value;
  if(event.target.classList.contains('text-input'))block.text=event.target.value;
  persist();
}

function ensureLayout(deck){
  if(deck.canvasInitialized&&deck.blocks.every(block=>block.layout))return;
  const rolePatterns=[/目的|宗旨|目标/,/主体|提供人|行为人/,/客体|对象|标的/,/情形|条件|何时|触发/,/权能|效力|结果|权利/,/属性|性质|归类/];
  const roles=rolePatterns.map(pattern=>deck.blocks.findIndex(block=>pattern.test(block.cue)));
  const semantic=deck.blocks.length===6&&roles.every(index=>index>=0)&&new Set(roles).size===6;
  const positions=semantic?[
    {x:325,y:35,w:310,h:150},{x:65,y:235,w:250,h:165},{x:645,y:235,w:250,h:165},
    {x:65,y:475,w:250,h:165},{x:645,y:475,w:250,h:165},{x:185,y:715,w:590,h:135}
  ]:deck.blocks.map((_,index)=>({x:index%2?535:65,y:40+Math.floor(index/2)*245,w:355,h:175}));
  deck.blocks.forEach((block,index)=>{block.colorIndex ??=index%15;block.summary ||=short(block.text,22);block.layout ||=semantic?{...positions[roles.indexOf(index)],shape:'rect'}:{...positions[index],shape:'rect'};});
  if(semantic&&deck.id==='sample-danbao'&&!deck.canvasInitialized&&!deck.connections?.length)deck.connections=[{from:deck.blocks[roles[1]].id,to:deck.blocks[roles[2]].id},{from:deck.blocks[roles[3]].id,to:deck.blocks[roles[4]].id}];
  deck.canvasInitialized=true;persist();
}
function originalFor(block,index){return block.quote||(current().id==='sample-danbao'?sampleQuotes[index]:null)||block.text||'';}
function canvasHeight(deck){return Math.max(580,...deck.blocks.map(block=>(block.layout?.y||0)+(block.layout?.h||170)+45));}
function endpoints(a,b){
  const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
  if(Math.abs(bc.x-ac.x)>Math.abs(bc.y-ac.y))return{from:{x:bc.x>ac.x?a.x+a.w:a.x,y:ac.y},to:{x:bc.x>ac.x?b.x:b.x+b.w,y:bc.y}};
  return{from:{x:ac.x,y:bc.y>ac.y?a.y+a.h:a.y},to:{x:bc.x,y:bc.y>ac.y?b.y:b.y+b.h}};
}
function renderConnections(holder){
  const deck=current(),svg=holder.querySelector('.connection-layer');if(!svg)return;
  holder.querySelectorAll('.connection-label').forEach(node=>node.remove());
  const editable=holder.id==='first-cards',marker=`arrow-${holder.id}`;svg.setAttribute('viewBox',`0 0 960 ${canvasHeight(deck)}`);svg.style.height=`${canvasHeight(deck)}px`;
  svg.innerHTML=`<defs><marker id="${marker}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11" fill="none" stroke="#8c9787" stroke-width="2"/></marker></defs>`;
  (deck.connections||[]).forEach(connection=>{
    connection.id ||=uid();const from=deck.blocks.find(block=>block.id===connection.from),to=deck.blocks.find(block=>block.id===connection.to);if(!from?.layout||!to?.layout)return;
    const points=endpoints(from.layout,to.layout);
    const makeLine=className=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value] of Object.entries({x1:points.from.x,y1:points.from.y,x2:points.to.x,y2:points.to.y}))line.setAttribute(key,value);line.setAttribute('class',className);svg.append(line);return line;};
    const line=makeLine(`connection-line${selectedConnectionId===connection.id&&editable?' selected':''}`);line.setAttribute('marker-end',`url(#${marker})`);
    if(editable){const hit=makeLine('connection-hit');hit.dataset.connectionId=connection.id;hit.setAttribute('tabindex','0');hit.setAttribute('role','button');hit.setAttribute('aria-label',`连线 ${from.cue} 到 ${to.cue}`);}
    if(editable||connection.label){const label=document.createElement(editable?'input':'span');label.className='connection-label';label.style.left=`${(points.from.x+points.to.x)/2}px`;label.style.top=`${(points.from.y+points.to.y)/2}px`;
      if(editable){label.value=connection.label||'';label.placeholder='＋ 关系';label.maxLength=60;label.dataset.connectionLabel=connection.id;label.setAttribute('aria-label',`${from.cue} 到 ${to.cue} 的关系`);}else label.textContent=connection.label;
      holder.append(label);
    }
  });
}
function selectConnection(id){selectedConnectionId=id;selectedNodeId=null;$$('#first-cards .canvas-node').forEach(node=>node.classList.remove('selected'));renderConnections($('#first-cards'));}
function deleteConnection(){if(!selectedConnectionId)return;current().connections=current().connections.filter(link=>link.id!==selectedConnectionId);selectedConnectionId=null;$('#connection-menu').hidden=true;persist();renderConnections($('#first-cards'));}
function renderCanvas(holder,phase){
  const deck=current();ensureLayout(deck);holder.replaceChildren();holder.style.height=`${canvasHeight(deck)}px`;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('connection-layer');svg.setAttribute('aria-label','积木关系连线');holder.append(svg);
  deck.blocks.forEach((block,index)=>{
    const layout=block.layout,color=(block.colorIndex??index)%15,node=document.createElement('div');
    node.className=`canvas-node shape-${layout.shape||'rect'} line-${color}${selectedNodeId===block.id&&phase==='first'?' selected':''}`;
    node.dataset.nodeId=block.id;node.style.left=`${layout.x}px`;node.style.top=`${layout.y}px`;node.style.width=`${layout.w}px`;node.style.height=`${layout.h}px`;
    if(phase==='first'){
      const shown=firstShown.has(block.id);
      node.innerHTML=`<div class="node-content"><h3>${esc(block.cue)}</h3>${shown?`<div class="node-answer">${esc(block.text)}</div>`:''}</div><button class="node-reveal" data-first-id="${esc(block.id)}" type="button">${shown?'重新遮盖 ↶':'揭晓 ↗'}</button>${['n','e','s','w','ne','se','sw','nw'].map(edge=>`<span class="resize-edge edge-${edge}" data-resize-edge="${edge}" aria-hidden="true"></span>`).join('')}`;
    }else{
      const level=secondLevel.get(block.id)||0;node.classList.add('second-node',`level-${level}`);if(lastFlippedId===block.id)node.classList.add('turning');
      const original=originalFor(block,index);
      node.innerHTML=`<button class="second-main" data-second-id="${esc(block.id)}" type="button" aria-label="${level===0?'翻开':level===1?'显示原文':'整体翻回'} ${esc(block.cue)}"><span class="second-index">${String(index+1).padStart(2,'0')}</span><span class="second-top">${level===0?'<b>?</b>':`<b>${esc(block.cue)}</b>`}</span><span class="second-bottom">${level===2?esc(original):level===1?'原文 ◇':'翻开 ↗'}</span></button>${level===1?`<button class="second-hide" data-second-hide="${esc(block.id)}" type="button">重新隐藏 ↶</button>`:''}`;
    }
    holder.append(node);
  });renderConnections(holder);
}
function renderFirst(){const deck=current();selectedNodeId ||=deck.blocks[0]?.id||null;renderCanvas($('#first-cards'),'first');$('#first-progress').textContent=`${firstShown.size} / ${deck.blocks.length} 已揭晓`;syncShapeToolbar();}
function renderSecond(){const deck=current();renderCanvas($('#second-cards'),'second');lastFlippedId=null;$('#second-progress').textContent=`${[...secondLevel.values()].filter(value=>value>0).length} / ${deck.blocks.length} 已翻开`;}
function syncShapeToolbar(){const block=current().blocks.find(item=>item.id===selectedNodeId);$$('[data-shape]').forEach(button=>button.classList.toggle('active',button.dataset.shape===(block?.layout?.shape||'rect')));$('#arrow-mode').classList.toggle('active',arrowMode);}
function selectCanvasNode(id){
  if(arrowMode){if(!arrowStartId){arrowStartId=id;toast('选择箭头终点');return;}if(arrowStartId!==id&&!current().connections.some(link=>link.from===arrowStartId&&link.to===id)){current().connections.push({id:uid(),from:arrowStartId,to:id,label:''});persist();renderFirst();}arrowStartId=null;arrowMode=false;syncShapeToolbar();return;}
  selectedConnectionId=null;$('#connection-menu').hidden=true;renderConnections($('#first-cards'));selectedNodeId=id;$$('#first-cards .canvas-node').forEach(node=>node.classList.toggle('selected',node.dataset.nodeId===id));syncShapeToolbar();
}
function resizedLayout(initial,edge,dx,dy){
  let left=initial.x,top=initial.y,right=left+initial.w,bottom=top+initial.h;
  if(edge.includes('w'))left=Math.max(0,Math.min(right-145,left+dx));
  if(edge.includes('e'))right=Math.min(960,Math.max(left+145,right+dx));
  if(edge.includes('n'))top=Math.max(0,Math.min(bottom-120,top+dy));
  if(edge.includes('s'))bottom=Math.max(top+120,bottom+dy);
  if(initial.shape==='circle'){
    const size=Math.min(edge.includes('w')?right:960-left,edge.includes('n')?bottom:Infinity,Math.max(145,edge==='n'||edge==='s'?bottom-top:right-left));
    if(edge.includes('w'))left=right-size;else right=left+size;
    if(edge.includes('n'))top=bottom-size;else bottom=top+size;
  }
  return {...initial,x:left,y:top,w:right-left,h:bottom-top};
}
function startGeometry(event){
  if(arrowMode||event.button!==0||event.target.closest('button,input,textarea'))return;
  const node=event.target.closest('.canvas-node');if(!node)return;
  const id=node.dataset.nodeId,block=current().blocks.find(item=>item.id===id);if(!block)return;
  const edge=event.target.closest('[data-resize-edge]')?.dataset.resizeEdge;
  event.preventDefault();selectCanvasNode(id);
  const initial={...block.layout},startX=event.clientX,startY=event.clientY;
  node.setPointerCapture(event.pointerId);node.classList.add('dragging');
  const move=moveEvent=>{
    const zoom=Number($('#first-cards').dataset.zoom)||1,dx=(moveEvent.clientX-startX)/zoom,dy=(moveEvent.clientY-startY)/zoom;
    block.layout=edge?resizedLayout(initial,edge,dx,dy):{...initial,x:Math.max(0,Math.min(960-initial.w,initial.x+dx)),y:Math.max(0,initial.y+dy)};
    Object.assign(node.style,{left:`${block.layout.x}px`,top:`${block.layout.y}px`,width:`${block.layout.w}px`,height:`${block.layout.h}px`});
    $('#first-cards').style.height=`${canvasHeight(current())}px`;renderConnections($('#first-cards'));
  };
  const done=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',done);node.removeEventListener('pointercancel',done);node.removeEventListener('lostpointercapture',done);node.classList.remove('dragging');if(node.hasPointerCapture?.(event.pointerId))node.releasePointerCapture(event.pointerId);persist();};
  node.addEventListener('pointermove',move);node.addEventListener('pointerup',done);node.addEventListener('pointercancel',done);node.addEventListener('lostpointercapture',done);
}

function startReviewSession(all=false){
  const eligible=state.decks.filter(deck=>deck.folderId===activeFolderId&&hasAnswer(deck));
  const due=eligible.filter(deck=>all||(deck.review?.dueAt||0)<=Date.now()).sort((a,b)=>(a.review?.dueAt||0)-(b.review?.dueAt||0));
  const selected=eligible.find(deck=>deck.id===state.currentId);
  reviewQueue=[...(selected?[selected.id]:[]),...due.filter(deck=>deck.id!==selected?.id).map(deck=>deck.id)];reviewIndex=0;reviewDone=new Set();reviewFlipped=false;renderReview();
}
function renderReview(){
  const finished=reviewIndex>=reviewQueue.length;$('#review-card').hidden=finished;$('#review-navigation').hidden=finished;$('#review-finished').hidden=!finished;
  const due=state.decks.filter(item=>item.folderId===activeFolderId&&hasAnswer(item)&&(item.review?.dueAt||0)<=Date.now()).length;$('#due-count').textContent=`${due} 张待复习`;
  if(finished){$('#rating-actions').hidden=true;$('#review-side-label').textContent='复习';$('#review-due').textContent='';return;}
  state.currentId=reviewQueue[reviewIndex];const deck=current();
  $('#review-due').textContent=fmtDue(deck.review?.dueAt);$('#review-position').textContent=`${reviewIndex+1} / ${reviewQueue.length}`;
  $('#review-prev').disabled=reviewIndex===0;$('#review-next').disabled=reviewIndex===reviewQueue.length-1;
  $('#review-side-label').textContent=reviewFlipped?'背面':'正面';$('#review-card').classList.toggle('is-back',reviewFlipped);$('#review-card').setAttribute('aria-label',reviewFlipped?'翻回正面':'翻到背面');
  const holder=$('#review-card-content');releaseImageUrls(holder.querySelector('.answer-images'));
  holder.innerHTML=reviewFlipped?`<span class="review-back">${esc(deck.originalText||deck.blocks.map(block=>block.text).join('。'))}</span><span class="answer-images review-answer-images"></span>`:`<strong>${esc(deck.title||'未命名卡片')}</strong>`;
  if(reviewFlipped)renderAnswerImages(holder.querySelector('.answer-images'),deck.answerImages||[],false);
  $('#review-flip-hint').textContent=reviewFlipped?'翻回正面 ↶':'点击翻面 ↗';$('#rating-actions').hidden=!reviewFlipped;renderDeckSelect();
}
function grade(rating){
  const deck=current(),previousReview=structuredClone(deck.review);deck.review ||= {};const review=deck.review,previous=review.intervalDays||0;let minutes;
  if(rating==='hard'){minutes=60;review.streak=0;review.intervalDays=0;}
  else if(rating==='good'){minutes=1440;review.streak=(review.streak||0)+1;review.intervalDays=1;}
  else{const next=previous<1?3:Math.min(60,Math.round(previous*2.4));minutes=next*1440;review.streak=(review.streak||0)+1;review.intervalDays=next;}
  review.dueAt=Date.now()+minutes*60000;review.lastRating=rating;review.history=[...(review.history||[]),{rating,at:Date.now()}].slice(-60);
  const previousStudy=structuredClone(state.study);
  StudyCore.addMetric(state.study,StudyCore.dayKey(Date.now()),'reviews',1);
  if(!persist()){deck.review=previousReview;state.study=previousStudy;return;}
  reviewDone.add(deck.id);reviewFlipped=false;
  let next=-1;for(let offset=1;offset<=reviewQueue.length;offset++){const index=(reviewIndex+offset)%reviewQueue.length;if(!reviewDone.has(reviewQueue[index])){next=index;break;}}
  reviewIndex=next<0?reviewQueue.length:next;renderReview();toast(`下次复习：${fmtDue(review.dueAt)}`);
}
function resetLearning(){firstShown=new Set();secondLevel=new Map();selectedNodeId=null;arrowStartId=null;arrowMode=false;activeStage='source';current().review={dueAt:Date.now(),intervalDays:0,streak:0,lastRating:null,history:[]};}
document.addEventListener('click',event=>{
  const editCard=event.target.closest('[data-deck-edit]');if(editCard){chooseDeck(editCard.dataset.deckEdit,'understand');openEditor(true);return;}
  const deleteCard=event.target.closest('[data-deck-delete]');if(deleteCard){pendingDeleteCardId=deleteCard.dataset.deckDelete;const deck=state.decks.find(item=>item.id===pendingDeleteCardId);$('#delete-card-name').textContent=deck.title;$('#delete-card-dialog').showModal();return;}
  const deleteBrick=event.target.closest('[data-delete-brick]');if(deleteBrick){removeSemanticBrick(deleteBrick.dataset.deleteBrick);return;}
  const line=event.target.closest('[data-connection-id]');if(line){selectConnection(line.dataset.connectionId);return;}
  if(!event.target.closest('#connection-menu'))$('#connection-menu').hidden=true;
  const rename=event.target.closest('[data-folder-rename]');if(rename){openFolderProperties(rename.dataset.folderRename);return;}
  const removeFolder=event.target.closest('[data-folder-delete]');if(removeFolder){
    const id=removeFolder.dataset.folderDelete,folder=state.folders.find(item=>item.id===id),cards=state.decks.filter(deck=>deck.folderId===id);
    if(confirm(`删除“${folder.name}”${cards.length?`及其中 ${cards.length} 张卡片`:''}？`)){
      const previous={folders:state.folders,decks:state.decks,currentId:state.currentId};
      state.folders=state.folders.filter(item=>item.id!==id);state.decks=state.decks.filter(deck=>deck.folderId!==id);if(!state.decks.some(deck=>deck.id===state.currentId))state.currentId=state.decks[0]?.id||null;
      if(!persist()){Object.assign(state,previous);return;}
      cards.flatMap(deck=>deck.answerImages||[]).forEach(image=>AnswerImages.remove(image.id).catch(()=>{}));activeFolderId=null;renderFolders();
    }return;
  }
  const nav=event.target.closest('[data-view]');if(nav){if(nav.dataset.view==='folders')activeFolderId=null;setView(nav.dataset.view);return;}
  const folder=event.target.closest('[data-folder-open]');if(folder){activeFolderId=folder.dataset.folderOpen;const first=state.decks.find(deck=>deck.folderId===activeFolderId);if(first)state.currentId=first.id;renderFolders();return;}
  const open=event.target.closest('[data-deck-open]');if(open){chooseDeck(open.dataset.deckOpen,'understand');return;}
  const direct=event.target.closest('[data-deck-review]');if(direct){chooseDeck(direct.dataset.deckReview,'review');return;}
  const stage=event.target.closest('[data-stage]');if(stage){setStage(stage.dataset.stage);return;}
  const color=event.target.closest('[data-paint-color]');if(color){paintColor=Number(color.dataset.paintColor);renderPaintColors();return;}
  const shape=event.target.closest('[data-shape]');if(shape){const block=current().blocks.find(item=>item.id===selectedNodeId);if(!block){toast('先选中积木');return;}block.layout.shape=shape.dataset.shape;if(shape.dataset.shape==='circle')block.layout.h=block.layout.w;persist();renderFirst();return;}
  const reveal=event.target.closest('[data-first-id]');if(reveal){const id=reveal.dataset.firstId;firstShown.has(id)?firstShown.delete(id):firstShown.add(id);renderFirst();return;}
  const hide=event.target.closest('[data-second-hide]');if(hide){lastFlippedId=hide.dataset.secondHide;secondLevel.set(hide.dataset.secondHide,0);renderSecond();return;}
  const flip=event.target.closest('[data-second-id]');if(flip){const id=flip.dataset.secondId;lastFlippedId=id;secondLevel.set(id,((secondLevel.get(id)||0)+1)%3);renderSecond();return;}
  const node=event.target.closest('#first-cards .canvas-node');if(node){selectCanvasNode(node.dataset.nodeId);return;}
  const rating=event.target.closest('[data-rating]');if(rating){grade(rating.dataset.rating);return;}
});
$('#first-cards').addEventListener('pointerdown',startGeometry);
$('#directory-brand').addEventListener('click',()=>{activeFolderId=null;setView('folders');});
$('#delete-card-cancel').addEventListener('click',()=>{$('#delete-card-dialog').close();pendingDeleteCardId=null;});
$('#delete-card-confirm').addEventListener('click',()=>{
  const id=pendingDeleteCardId,deck=state.decks.find(item=>item.id===id);if(!deck)return;
  const previous={decks:state.decks,currentId:state.currentId};
  state.decks=state.decks.filter(item=>item.id!==id);if(state.currentId===id)state.currentId=state.decks.find(item=>item.folderId===activeFolderId)?.id||state.decks[0]?.id||null;
  if(!persist()){Object.assign(state,previous);return;}
  (deck.answerImages||[]).forEach(image=>AnswerImages.remove(image.id).catch(()=>{}));$('#delete-card-dialog').close();pendingDeleteCardId=null;renderFolders();
});
$('#answer-image-file').addEventListener('change',event=>uploadAnswerImages([...event.target.files]));
$('#answer-image-drafts').addEventListener('click',event=>{const button=event.target.closest('[data-remove-answer-image]');if(!button)return;const id=button.dataset.removeAnswerImage;draftAnswerImages=draftAnswerImages.filter(image=>image.id!==id);if(!state.decks.some(deck=>(deck.answerImages||[]).some(image=>image.id===id)))AnswerImages.remove(id).catch(()=>{});renderAnswerImages($('#answer-image-drafts'),draftAnswerImages,true);});
$('#review-prev').addEventListener('click',()=>{if(reviewIndex>0){reviewIndex--;reviewFlipped=false;renderReview();}});
$('#review-next').addEventListener('click',()=>{if(reviewIndex<reviewQueue.length-1){reviewIndex++;reviewFlipped=false;renderReview();}});
$('#review-restart').addEventListener('click',()=>startReviewSession(true));
$('#first-cards').addEventListener('input',event=>{const input=event.target.closest('[data-connection-label]');if(!input)return;const link=current().connections.find(item=>item.id===input.dataset.connectionLabel);if(link){link.label=input.value;persist();}});
$('#first-cards').addEventListener('contextmenu',event=>{
  const line=event.target.closest('[data-connection-id],[data-connection-label]');if(!line)return;event.preventDefault();selectConnection(line.dataset.connectionId||line.dataset.connectionLabel);
  const menu=$('#connection-menu');menu.hidden=false;menu.style.left=`${Math.max(8,Math.min(event.clientX,window.innerWidth-145))}px`;menu.style.top=`${Math.max(8,Math.min(event.clientY,window.innerHeight-55))}px`;
});
$('#connection-delete').addEventListener('click',deleteConnection);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){$('#connection-menu').hidden=true;selectedConnectionId=null;if(activeStage==='first')renderConnections($('#first-cards'));}
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const line=event.target.closest('[data-connection-id]');
  if(line&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectConnection(line.dataset.connectionId);}
  if(event.key==='Delete'&&activeView==='understand'&&activeStage==='first'&&selectedConnectionId){event.preventDefault();deleteConnection();}
});
$('#folder-color-options').addEventListener('click',event=>{const color=event.target.closest('[data-folder-color]');if(color){folderColor=Number(color.dataset.folderColor);renderFolderColors();}});
$('#folder-properties-close').addEventListener('click',()=>$('#folder-properties').close());
$('#folder-properties-cancel').addEventListener('click',()=>$('#folder-properties').close());
$('#folder-properties-form').addEventListener('submit',event=>{
  event.preventDefault();const name=clean($('#folder-name').value);if(!name){$('#folder-properties-error').textContent='请输入名称';return;}
  if(state.folders.some(folder=>folder.id!==editingFolderId&&folder.name===name)){$('#folder-properties-error').textContent='文件夹名称已存在';return;}
  let folder=state.folders.find(item=>item.id===editingFolderId);if(!folder){folder={id:uid()};state.folders.push(folder);}
  Object.assign(folder,{name,colorIndex:folderColor,description:clean($('#folder-description').value)});persist();$('#folder-properties').close();renderFolders();
});
$('#brand-home').addEventListener('click',()=>{activeFolderId=null;setView('folders');});
$('#deck-select').addEventListener('change',event=>chooseDeck(event.target.value,'understand'));
$('#new-folder').addEventListener('click',()=>openFolderProperties());
$('#back-folders').addEventListener('click',()=>{activeFolderId=null;$('#import-panel').hidden=true;renderFolders();});
$('#new-deck').addEventListener('click',newDeck);$('#folder-new-deck').addEventListener('click',newDeck);
$('#import-open').addEventListener('click',()=>{$('#import-panel').hidden=false;$('#import-file').focus();});
$('#import-close').addEventListener('click',()=>{$('#import-panel').hidden=true;});
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  importRows=[];importColumns=[];importWorkbook=null;$('#import-confirm').disabled=true;$('#import-preview').replaceChildren();$('#import-count').textContent='读取中…';$('#import-sheet-wrap').hidden=true;
  try{
    if(/\.(xlsx|xls)$/i.test(file.name)){
      importWorkbook=XLSX.read(await file.arrayBuffer(),{type:'array'});const select=$('#import-sheet');select.replaceChildren();
      importWorkbook.SheetNames.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);});
      $('#import-sheet-wrap').hidden=importWorkbook.SheetNames.length<2;readImportSheet();
    }else prepareImport(await file.text(),file.name);
  }catch{importRows=[];$('#import-confirm').disabled=true;$('#import-count').textContent='无法读取，请按模板检查文件';toast('无法读取这个文件');}
});
$('#import-sheet').addEventListener('change',readImportSheet);
$('#semantic-bricks').addEventListener('input',event=>{const input=event.target.closest('[data-brick-name]');if(!input)return;const block=current().blocks.find(item=>item.id===input.dataset.brickName);if(block){block.cue=input.value;persist();renderAnnotated();}});
['import-front','import-back','import-folder-column'].forEach(id=>$(`#${id}`).addEventListener('change',renderImportPreview));
$('#import-confirm').addEventListener('click',commitImport);
$('#source-text').addEventListener('input',event=>{$('#source-count').textContent=`${event.target.value.length} 字`;});
$('#confirm-source').addEventListener('click',()=>confirmSource(true));
$('#save-source-only').addEventListener('click',()=>confirmSource(false));
$('#edit-source').addEventListener('click',()=>openEditor(true));
$('#paint-mode-toggle').addEventListener('click',togglePaint);
$('#paint-surface').addEventListener('mouseup',paintSelection);
$('#paint-surface').addEventListener('keyup',event=>{if(event.key==='Shift'||event.key.startsWith('Arrow'))paintSelection();});
$('#split-text').addEventListener('click',()=>{const deck=current(),text=clean($('#source-text').value);if(!text){toast('先粘贴原文');return;}if(deck.blocks.length&&text===deck.lastSplitText){toast('可直接修改下方积木');return;}
  deck.originalText=text;deck.lastSplitText=text;deck.blocks=splitText(text);deck.connections=[];deck.canvasInitialized=false;deck.title=clean(text.split(/[，,。！？；;\n]/u)[0]).slice(0,18)||'新卡片';resetLearning();persist();renderUnderstand();toast('已拆解，可继续用画笔调整');
});
$('#blocks-editor').addEventListener('input',saveBlockEdit);
$('#blocks-editor').addEventListener('click',event=>{const remove=event.target.closest('.remove-block');if(!remove)return;const id=remove.closest('.block-editor').dataset.id,deck=current();deck.blocks=deck.blocks.filter(block=>block.id!==id);deck.connections=deck.connections.filter(link=>link.from!==id&&link.to!==id);resetLearning();persist();renderUnderstand();});
$('#add-block').addEventListener('click',()=>{const deck=current();deck.blocks.push({id:uid(),cue:`要点 ${deck.blocks.length+1}`,summary:'',text:'',quote:'',colorIndex:deck.blocks.length%15});deck.canvasInitialized=false;persist();renderUnderstand();$('#blocks-editor .block-editor:last-child .cue-input')?.focus();});
$('#save-blocks').addEventListener('click',()=>{if(current().blocks.some(block=>!clean(block.cue)||!clean(block.text))){toast('每块需要线索和内容');return;}persist();renderUnderstand();openEditor(false);setStage('source');});
$('#start-understanding').addEventListener('click',()=>{if(!current().sourceConfirmed){openEditor(true);return;}if(!current().blocks.length){if(!paintMode)togglePaint();toast('选中文字，划分意群');return;}if($('#include-first').checked)setStage('first');else if($('#include-second').checked)setStage('second');else toast('选择一阶或二阶');});
['first','second'].forEach(name=>$(`#include-${name}`).addEventListener('change',()=>{current().studyOptions={first:$('#include-first').checked,second:$('#include-second').checked};persist();}));
$('#first-next').addEventListener('click',()=>setStage($('#include-second').checked?'second':'source'));
$('#arrow-mode').addEventListener('click',()=>{arrowMode=!arrowMode;arrowStartId=null;syncShapeToolbar();if(arrowMode)toast('依次点击两块积木');});
$('#clear-arrows').addEventListener('click',()=>{current().connections=[];persist();renderFirst();});
$('#review-card').addEventListener('click',()=>{reviewFlipped=!reviewFlipped;renderReview();});
renderDeckSelect();renderUnderstand();renderFolders();setView('folders');
