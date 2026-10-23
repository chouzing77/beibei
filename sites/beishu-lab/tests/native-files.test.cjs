const test=require('node:test'),assert=require('node:assert/strict');
const {boot,read}=require('./helpers.cjs');
test('Android 保存桥分块传输可完整还原文件，系统确认后才成功',async t=>{
  const a=boot(t),chunks=[];let pending,filename;
  a.w.BeibeiAndroid={beginSave(id,name){pending=id;filename=name},appendSave(id,bytes){assert.equal(id,pending);chunks.push(Buffer.from(bytes,'base64'))},finishSave(){}};
  a.w.eval(read('platform-files.js'));
  const bytes=Buffer.alloc(100000);for(let i=0;i<bytes.length;i++)bytes[i]=i%256;
  let done=false;const saving=a.w.NativeFiles.save(new Blob([bytes],{type:'application/json'}),'背背备份.json').then(()=>done=true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);assert.equal(chunks.length,4);assert.deepEqual(Buffer.concat(chunks),bytes);assert.equal(filename,'背背备份.json');
  a.w.beibeiFileResult(pending,true,'');await saving;assert.equal(done,true);
});
test('Android 取消保存和原生空间不足会返回失败，允许重试',async t=>{
  const a=boot(t);let pending;
  a.w.BeibeiAndroid={beginSave(id){pending=id},appendSave(){},finishSave(){a.w.beibeiFileResult(pending,false,'保存已取消')}};
  a.w.eval(read('platform-files.js'));await assert.rejects(a.w.NativeFiles.save(new Blob(['hi']),'a.json'),/取消/);
  a.w.BeibeiAndroid.appendSave=()=>{throw Error('存储空间不足')};await assert.rejects(a.w.NativeFiles.save(new Blob(['hi']),'a.json'),/空间/);
  a.w.BeibeiAndroid.appendSave=()=>{};a.w.BeibeiAndroid.finishSave=()=>a.w.beibeiFileResult(pending,true,'');await a.w.NativeFiles.save(new Blob(['hi']),'a.json');
});
