// Image blobs stay in IndexedDB; card records only contain image IDs.
const AnswerImages=(()=>{
  let pending;
  function db(){return pending ||=new Promise((resolve,reject)=>{
    const request=indexedDB.open('beibei-answer-images',2);
    request.onupgradeneeded=()=>{for(const name of ['images','recovery'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>{pending=null;reject(request.error);};
  });}
  async function put(id,blob){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('images','readwrite');tx.objectStore('images').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function get(id){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction('images').objectStore('images').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function remove(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('images','readwrite');tx.objectStore('images').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async function recovery(value){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('recovery',value===undefined?'readonly':'readwrite'),store=tx.objectStore('recovery');const request=value===undefined?store.get('last'):store.put(value,'last');tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  return {put,get,remove,recovery};
})();
