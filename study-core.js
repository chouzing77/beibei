(function(root){
  'use strict';
  const dayKey=time=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function day(study,key){return study.days[key] ||= {reviews:0,focusMs:0,sessions:0};}
  let deviceId;
  function device(){
    if(deviceId)return deviceId;
    try{deviceId=root.localStorage?.getItem('beibei-device-id');}catch{}
    deviceId ||= root.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random()}`;
    try{root.localStorage?.setItem('beibei-device-id',deviceId);}catch{}
    return deviceId;
  }
  function ensureSources(study){
    if(!study.sources)study.sources={[`legacy-${root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`}`]:JSON.parse(JSON.stringify(study.days))};
    return study;
  }
  function addMetric(study,key,metric,value){
    ensureSources(study);const source=study.sources[device()] ||= {};
    (source[key] ||= {reviews:0,focusMs:0,sessions:0})[metric]+=value;
    day(study,key)[metric]+=value;
  }
  function rebuild(study){study.days={};for(const source of Object.values(study.sources||{}))for(const [key,entry] of Object.entries(source))for(const metric of ['reviews','focusMs','sessions'])day(study,key)[metric]+=entry[metric]||0;return study;}
  function create(decks=[]){
    const study={version:1,days:{},timer:{durationMs:1500000,remainingMs:1500000,startedAt:null,status:'idle'}};
    // Import the history still present on older cards once. New totals survive card deletion.
    for(const deck of decks)for(const event of deck.review?.history||[])if(Number.isFinite(event.at))day(study,dayKey(event.at)).reviews++;
    return study;
  }
  function addFocus(study,start,end){
    while(start<end){const d=new Date(start),midnight=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),stop=Math.min(end,midnight);addMetric(study,dayKey(start),'focusMs',stop-start);start=stop;}
  }
  function settle(study,now){
    const timer=study.timer;if(timer.status!=='running'||now<=timer.startedAt)return false;
    const elapsed=Math.min(timer.remainingMs,now-timer.startedAt),end=timer.startedAt+elapsed;
    addFocus(study,timer.startedAt,end);timer.remainingMs-=elapsed;timer.startedAt=end;
    if(timer.remainingMs===0){timer.status='complete';timer.startedAt=null;addMetric(study,dayKey(end-1),'sessions',1);return true;}
    return false;
  }
  function act(study,action,now,minutes){
    settle(study,now);const t=study.timer;
    if(action==='duration'){
      if(t.status==='running'||t.status==='paused')throw Error('先结束本次专注');
      if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw Error('请输入 1–180 分钟的整数');
      t.durationMs=minutes*60000;t.remainingMs=t.durationMs;t.status='idle';t.startedAt=null;
    }else if(action==='start'&&t.status!=='running'){
      if(t.status!=='paused')t.remainingMs=t.durationMs;t.status='running';t.startedAt=now;
    }else if(action==='pause'&&t.status==='running'){t.status='paused';t.startedAt=null;}
    else if(action==='reset'){t.remainingMs=t.durationMs;t.startedAt=null;t.status='idle';}
  }
  const api={dayKey,day,create,settle,act,addFocus,ensureSources,addMetric,rebuild};root.StudyCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
