const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../study-core.js');const {boot,seed}=require('./helpers.cjs');
test('番茄钟默认25分钟，暂停不累计，恢复只计剩余时间',()=>{
 const s=C.create();assert.equal(s.timer.durationMs,25*60000);C.act(s,'start',100000);C.act(s,'pause',160000);assert.equal(s.timer.remainingMs,24*60000);C.settle(s,999999);assert.equal(s.timer.remainingMs,24*60000);C.act(s,'start',1000000);C.settle(s,1060000);assert.equal(s.timer.remainingMs,23*60000);assert.equal(Object.values(s.days)[0].focusMs,120000);
});
test('刷新恢复、关闭超时后只计目标时长，完成不会重复统计',()=>{
 const s=C.create();C.act(s,'duration',0,1);C.act(s,'start',1000);C.settle(s,16000);const restored=JSON.parse(JSON.stringify(s));assert.equal(C.settle(restored,900000),true);C.settle(restored,1000000);assert.equal(Object.values(restored.days)[0].focusMs,60000);assert.equal(Object.values(restored.days)[0].sessions,1);
});
test('跨午夜按当地日期拆分，闰年2月29日正确记录',()=>{
 const start=new Date(2024,1,28,23,59,30).getTime(),s=C.create();C.act(s,'duration',start,1);C.act(s,'start',start);C.settle(s,start+60000);assert.equal(s.days['2024-02-28'].focusMs,30000);assert.equal(s.days['2024-02-29'].focusMs,30000);assert.equal(s.days['2024-02-29'].sessions,1);
});
test('中途结束保留实际时长，禁止非法时长和运行中修改',()=>{
 const s=C.create();for(const value of [0,-1,181,NaN,1.5])assert.throws(()=>C.act(s,'duration',0,value));C.act(s,'start',1000);assert.throws(()=>C.act(s,'duration',1000,5));C.act(s,'reset',31000);assert.equal(s.timer.status,'idle');assert.equal(Object.values(s.days)[0].focusMs,30000);assert.equal(Object.values(s.days)[0].sessions,0);
});
test('系统时间回退不增加时长',()=>{const s=C.create();C.act(s,'start',1000);C.settle(s,0);assert.deepEqual(s.days,{});assert.equal(s.timer.remainingMs,1500000);});
test('旧复习历史迁移一次，独立于卡片删除',()=>{const decks=[{review:{history:[{at:1000},{at:2000}]}}],s=C.create(decks);decks.length=0;assert.equal(Object.values(s.days)[0].reviews,2);});
test('空目录可进入统计和专注，年月切换及热力图每日明细正常',t=>{
 const a=boot(t,{state:{decks:[],folders:[]}});a.click('[data-view="stats"]');assert(a.d.querySelector('#view-stats').classList.contains('active'));const year=new Date().getFullYear();assert.equal(a.d.querySelectorAll('[data-day]').length,(new Date(year,1,29).getMonth()===1)?366:365);const month=a.d.querySelector('#stats-month');month.value='2';month.dispatchEvent(new a.w.Event('change'));assert.equal(a.d.querySelectorAll('[data-day]').length,new Date(year,2,0).getDate());a.click('[data-view="focus"]');assert.equal(a.d.querySelector('#focus-clock').textContent,'25:00');a.click('[data-minutes="45"]');assert.equal(a.api.state.study.timer.durationMs,45*60000);a.click('#focus-toggle');assert.equal(a.api.state.study.timer.status,'running');a.click('#focus-toggle');assert.equal(a.api.state.study.timer.status,'paused');a.click('#focus-reset');assert.equal(a.api.state.study.timer.status,'idle');
});
test('复习成功才增加每日统计，保存失败回滚且不前进',t=>{
 const a=boot(t);a.click('[data-folder-open="f"]');a.click('[data-deck-review="c0"]');a.click('#review-card');a.click('[data-rating="good"]');const key=C.dayKey(Date.now());assert.equal(a.api.state.study.days[key].reviews,1);a.click('#review-card');a.w.Storage.prototype.setItem=function(){throw Error('quota')};a.click('[data-rating="good"]');assert.equal(a.api.state.study.days[key].reviews,1);assert.equal(a.api.current().id,'c1');
});
test('计时保存失败不能假装启动，刷新恢复仍保留正确状态',t=>{
 const a=boot(t);a.click('[data-view="focus"]');a.w.Storage.prototype.setItem=function(){throw Error('quota')};a.click('#focus-toggle');assert.equal(a.api.state.study.timer.status,'idle');assert.equal(a.d.querySelector('#focus-toggle').textContent,'开始专注');
});
