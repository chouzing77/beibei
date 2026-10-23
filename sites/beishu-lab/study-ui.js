/* Local study records share one atomic save with cards and the timer. */
(()=>{
  const C=StudyCore,now=new Date();let selectedDay=C.dayKey(now),lastCheckpoint=0;
  const yearSelect=$('#stats-year'),monthSelect=$('#stats-month');
  for(let month=1;month<=12;month++)monthSelect.add(new Option(`${month} 月`,month));
  function syncYears(){
    const year=new Date().getFullYear(),selected=Number(yearSelect.value)||year;
    const years=[...new Set([year,selected,...Object.keys(state.study.days).map(key=>Number(key.slice(0,4)))])].sort((a,b)=>b-a);
    yearSelect.replaceChildren(...years.map(y=>new Option(`${y} 年`,y)));yearSelect.value=selected;
  }
  const duration=ms=>{const seconds=Math.floor(ms/1000);return seconds<60?`${seconds} 秒`:`${Math.floor(seconds/60)} 分 ${seconds%60} 秒`;};
  function snapshot(){const copy=structuredClone(state.study);C.settle(copy,Date.now());return copy;}
  function saveAction(action,minutes){
    const previous=structuredClone(state.study);
    try{C.act(state.study,action,Date.now(),minutes);if(!persist()){state.study=previous;return false;}}
    catch(error){state.study=previous;$('#focus-error').textContent=error.message;return false;}
    $('#focus-error').textContent='';renderFocus();if(activeView==='stats')renderStats();return true;
  }
  function checkpoint(){
    if(state.study.timer.status!=='running')return;
    const previous=structuredClone(state.study),complete=C.settle(state.study,Date.now());
    if(!persist()){state.study=previous;return;}
    lastCheckpoint=Date.now();if(complete){toast('本次专注完成');$('#focus-status').textContent='本次完成';}
    if(activeView==='stats')renderStats();
  }
  function renderFocus(){
    const study=snapshot(),t=study.timer,seconds=Math.ceil(t.remainingMs/1000),text=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    $('#focus-clock').textContent=text;
    $('#focus-ring').style.setProperty('--progress',`${100*(1-t.remainingMs/t.durationMs)}%`);
    const status={idle:'准备开始',running:'专注中',paused:'已暂停',complete:'本次完成'}[t.status];
    $('#focus-status').textContent=status;
    $('#focus-toggle').textContent=({idle:'开始专注',running:'暂停',paused:'继续专注',complete:'再专注一次'})[t.status];
    const busy=['running','paused'].includes(t.status);
    $('#focus-reset').disabled=!busy;
    $('#focus-minutes').disabled=busy;
    if(document.activeElement!==$('#focus-minutes'))$('#focus-minutes').value=t.durationMs/60000;
    $$('[data-minutes]').forEach(button=>{button.disabled=busy;button.classList.toggle('selected',Number(button.dataset.minutes)===t.durationMs/60000);});
    const today=study.days[C.dayKey(Date.now())]||{};
    $('#focus-today').textContent=`今日 ${duration(today.focusMs||0)} · ${today.sessions||0} 个番茄钟`;
    $('#focus-badge').hidden=!busy||activeView==='focus';$('#focus-badge').textContent=`${status} · ${text}`;
  }
  function dateRange(year,month){
    const dates=[],end=new Date(year,month||12,1),date=new Date(year,month?month-1:0,1);
    while(date<end){dates.push(C.dayKey(date));date.setDate(date.getDate()+1);}return dates;
  }
  function chart(dates,days,metric,label){
    if(!dates.length)return '<p class="chart-empty">暂无记录</p>';
    const values=dates.map(key=>metric==='reviews'?(days[key]?.reviews||0):(days[key]?.focusMs||0)/60000);
    const max=Math.max(metric==='reviews'?4:5,...values),width=600,height=200,left=42,top=18,bottom=166;
    const point=(value,index)=>[left+index*(width-left-16)/Math.max(1,dates.length-1),bottom-value/max*(bottom-top)];
    const line=values.map((v,i)=>point(v,i).join(',')).join(' ');
    let grid='';for(let i=0;i<3;i++){const value=max*i/2,y=point(value,0)[1];grid+=`<line x1="${left}" x2="584" y1="${y}" y2="${y}" class="chart-grid"/><text x="32" y="${y+4}" text-anchor="end">${Number(value.toFixed(1))}</text>`;}
    const labels=[0,Math.floor((dates.length-1)/2),dates.length-1].map((i,n)=>`<text x="${point(0,i)[0]}" y="191" text-anchor="${n===0?'start':n===2?'end':'middle'}">${dates[i].slice(5).replace('-','/')}</text>`).join('');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}，每日数值见下方每日记录"><title>${label}</title>${grid}<polyline points="${line}" class="chart-line ${metric==='focusMs'?'focus-line':''}"/>${values.map((v,i)=>{const [x,y]=point(v,i);return `<circle cx="${x}" cy="${y}" r="${dates.length>31?2:3}" class="chart-point"><title>${dates[i]} · ${Number(v.toFixed(1))}${metric==='reviews'?' 次':' 分钟'}</title></circle>`;}).join('')}${labels}</svg>`;
  }
  function detail(key,study){const d=study.days[key]||{};return `${key} · 复习 ${d.reviews||0} 次 · 专注 ${duration(d.focusMs||0)}`;}
  function renderStats(){
    syncYears();const study=snapshot(),year=Number(yearSelect.value),month=Number(monthSelect.value),dates=dateRange(year,month),today=C.dayKey(Date.now());
    const totals=dates.reduce((sum,key)=>{const d=study.days[key]||{};sum.reviews+=d.reviews||0;sum.focusMs+=d.focusMs||0;sum.active+=((d.reviews||0)>0||(d.focusMs||0)>0)?1:0;return sum;},{reviews:0,focusMs:0,active:0});
    $('#stats-totals').innerHTML=`<div><span>活跃天数</span><strong>${totals.active}<small> 天</small></strong></div><div><span>复习次数</span><strong>${totals.reviews}<small> 次</small></strong></div><div><span>专注时长</span><strong>${Number((totals.focusMs/60000).toFixed(1))}<small> 分钟</small></strong></div>`;
    const metric=$('#heat-metric').value,thresholds=metric==='reviews'?[1,5,15,30]:[1,25*60000,60*60000,120*60000];
    const map=$('#heatmap');map.className=`heatmap ${month?'month-map':'year-map'}`;
    const first=new Date(year,month?month-1:0,1),offset=(first.getDay()+6)%7;
    if(!dates.includes(selectedDay))selectedDay=dates.includes(today)?today:dates[0];
    const monthLabels=month?'':`<div class="heat-month-labels">${Array.from({length:12},(_,i)=>`<span>${i+1} 月</span>`).join('')}</div>`;
    map.innerHTML=monthLabels+`<div class="heat-grid">${month?['一','二','三','四','五','六','日'].map(s=>`<span class="weekday">${s}</span>`).join(''):''}${'<span class="heat-pad"></span>'.repeat(offset)}${dates.map(key=>{const value=study.days[key]?.[metric]||0,level=thresholds.filter(x=>value>=x).length;return `<button type="button" data-day="${key}" class="heat-day heat-${level}${key===today?' today':''}" aria-label="${esc(detail(key,study))}" aria-pressed="${key===selectedDay}" title="${esc(detail(key,study))}" ${key>today?'disabled':''}>${month?Number(key.slice(-2)):''}</button>`;}).join('')}</div>`;
    $('#heat-detail').textContent=detail(selectedDay,study);
    $('#heat-legend').innerHTML=(metric==='reviews'?['0','1–4','5–14','15–29','30+ 次']:['0','<25','25–59','60–119','120+ 分']).map((text,i)=>`<span><i class="heat-${i}"></i>${text}</span>`).join('');
    const elapsedDates=dates.filter(key=>key<=today);
    $('#activity-chart').innerHTML=chart(elapsedDates,study.days,'reviews','每日复习次数');$('#focus-chart').innerHTML=chart(elapsedDates,study.days,'focusMs','每日专注分钟数');
    $('#stats-rows').innerHTML=dates.filter(key=>key<=today).reverse().map(key=>{const d=study.days[key]||{};return `<tr><td>${key}</td><td>${d.reviews||0}</td><td>${duration(d.focusMs||0)}</td><td>${d.sessions||0}</td></tr>`;}).join('');
  }
  [yearSelect,monthSelect,$('#heat-metric')].forEach(el=>el.addEventListener('change',renderStats));
  $('#heatmap').addEventListener('click',event=>{const button=event.target.closest('[data-day]');if(button){selectedDay=button.dataset.day;$$('[data-day]').forEach(b=>b.setAttribute('aria-pressed',b===button));$('#heat-detail').textContent=detail(selectedDay,snapshot());}});
  $('#focus-toggle').addEventListener('click',()=>{
    if(['idle','complete'].includes(state.study.timer.status)&&!saveAction('duration',Number($('#focus-minutes').value)))return;
    saveAction(state.study.timer.status==='running'?'pause':'start');
  });
  $('#focus-reset').addEventListener('click',()=>saveAction('reset'));
  $('#focus-minutes').addEventListener('change',()=>saveAction('duration',Number($('#focus-minutes').value)));
  $$('[data-minutes]').forEach(button=>button.addEventListener('click',()=>saveAction('duration',Number(button.dataset.minutes))));
  window.addEventListener('pagehide',checkpoint);
  document.addEventListener('visibilitychange',()=>{checkpoint();renderFocus();});
  // Keep another open tab in sync; desktop itself is single-instance.
  window.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;try{const fresh=JSON.parse(event.newValue);if(fresh.study&&Array.isArray(fresh.decks)){state=fresh;renderFocus();if(activeView==='stats')renderStats();}}catch{}});
  window.StudyUI={renderStats,renderFocus};
  checkpoint();renderFocus();
  setInterval(()=>{const t=state.study.timer;if(t.status==='running'&&(Date.now()-lastCheckpoint>=15000||Date.now()>=t.startedAt+t.remainingMs))checkpoint();renderFocus();},1000);
})();
