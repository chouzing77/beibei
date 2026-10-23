const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function seed(count=3){return {folders:[{id:'f',name:'课程'}],currentId:'c0',decks:Array.from({length:count},(_,i)=>({id:`c${i}`,folderId:'f',title:`问题${i}`,originalText:`答案${i}。第二意群。`,blocks:[],connections:[],sourceConfirmed:false,review:{dueAt:0,history:[]}}))};}
function boot(t,{state=seed(),db=new IDBFactory()}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://beibei.test/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window,d=w.document;
 w.indexedDB=db;w.scrollTo=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=>`blob:test-${Math.random()}`;w.URL.revokeObjectURL=()=>{};w.File=File;w.Blob=Blob;w.structuredClone=structuredClone;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.hasPointerCapture=()=>false;
 if(state)w.localStorage.setItem('beishu-blocks-v1',JSON.stringify(state));
 w.eval(read('vendor/xlsx.full.min.js'));
 w.matchMedia=()=>({matches:false});
 w.eval(read('answer-images.js')+'\n'+read('study-core.js')+'\n'+read('app-v3.js')+'\n'+read('study-ui.js')+'\n'+read('platform-files.js')+'\n'+read('backup.js')+'\n'+read('mobile.js')+'\nwindow.testApi={get state(){return state},current,prepareImport,commitImport,uploadAnswerImages,images:AnswerImages,resizedLayout,backup:BeibeiBackup};');
 const app={w,d,db,errors,api:w.testApi,click(selector){const element=d.querySelector(selector);if(!element)throw Error(`Missing ${selector}`);if(element.click)element.click();else element.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));},input(selector,value){const element=d.querySelector(selector);element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));},selectText(start,end){const surface=d.querySelector('#paint-surface'),walker=d.createTreeWalker(surface,w.NodeFilter.SHOW_TEXT);let offset=0,node,startNode,endNode,so,eo;while(node=walker.nextNode()){if(startNode===undefined&&start<=offset+node.length){startNode=node;so=start-offset;}if(end<=offset+node.length){endNode=node;eo=end-offset;break;}offset+=node.length;}const range=d.createRange();range.setStart(startNode,so);range.setEnd(endNode,eo);w.getSelection().removeAllRanges();w.getSelection().addRange(range);surface.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));},async file(file){const buffer=await file.arrayBuffer();file.arrayBuffer=async()=>new w.Uint8Array(new Uint8Array(buffer)).buffer;const input=d.querySelector('#import-file');Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change'));await settle();},close(){dom.window.close();}};
 if(t)t.after(()=>{dom.window.close();if(errors.length)throw Error(errors.join('\n'));});
 return app;
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
function openCard(app,id='c0'){app.click(`[data-folder-open="f"]`);app.click(`[data-deck-open="${id}"]`);}
module.exports={boot,seed,settle,openCard,root,read};
