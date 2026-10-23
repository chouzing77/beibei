/* The Android bridge only exists inside the bundled, network-isolated app. */
(()=>{
  if(!window.BeibeiAndroid)return;
  let callbacks=new Map();
  window.beibeiFileResult=(id,ok,message)=>{const cb=callbacks.get(id);if(!cb)return;callbacks.delete(id);ok?cb.resolve():cb.reject(Error(message||'保存已取消'));};
  async function save(blob,name){
    const id=crypto.randomUUID(),bytes=new Uint8Array(await blob.arrayBuffer());
    const result=new Promise((resolve,reject)=>callbacks.set(id,{resolve,reject}));
    try{BeibeiAndroid.beginSave(id,name,blob.type||'application/octet-stream');for(let i=0;i<bytes.length;i+=32768)BeibeiAndroid.appendSave(id,btoa(String.fromCharCode(...bytes.subarray(i,i+32768))));BeibeiAndroid.finishSave(id);}catch(error){callbacks.delete(id);throw error;}
    return result;
  }
  window.NativeFiles={save};
  document.addEventListener('click',async event=>{const a=event.target.closest('a[download]');if(!a)return;event.preventDefault();try{const response=await fetch(a.href);if(!response.ok)throw Error('模板读取失败');await save(await response.blob(),a.getAttribute('download')||a.href.split('/').pop());}catch(error){toast(error.message);}});
})();
