// No dependencies: run `node test.cjs` from any directory.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const core = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
const ui = html.match(/<script id="game-ui">([\s\S]*?)<\/script>/)[1];
let assertions = 0;
function check(a,b,message){assert.deepEqual(a,b,message);assertions++;}
const ctx = vm.createContext({console});
vm.runInContext(core+'\nglobalThis.api={SCHOOLS,createState,applyBad,advance,chooseGood,continueWork,finishPhone,resumePhone,slotLabel,WORD_BANK,SLICE_RULES,makeSliceDeck,slicePassed,segmentHitsRect,meetingIncome,beginSlice,completeSlice,acceptSlice,resolveAngry};',ctx);
const g=ctx.api;const rawAdvance=g.advance;g.advance=s=>{const result=rawAdvance(s);if(s.phase==='angry')g.resolveAngry(s,false);return result;};
check(g.SCHOOLS.length,10,'ten schools');
check(new Set(g.SCHOOLS.map(s=>s.name)).size,10,'unique schools');
check(new Set(g.SCHOOLS.map(s=>s.teacher)).size,10,'unique teachers');
check(g.SCHOOLS.every(s=>/^[\u4e00-\u9fff]OO$/.test(s.teacher)),true,'teachers shown as surname plus OO');
check(g.SCHOOLS[0].bad,'在摘要中忽略錄影紀錄','requested case wording');
check(new Set(g.SCHOOLS.map(s=>s.failure)).size,10,'unique failure indices');
// Exact grid verifies 0 => 100% blocked, 70 => 30% blocked, 100 => 0% blocked.
for(const failure of [0,70,100]){
 const i=g.SCHOOLS.findIndex(s=>s.failure===failure);let blocked=0;
 for(let k=0;k<1000;k++){const s=g.createState('邊界測試');s.index=i;g.applyBad(s,()=>k/1000);blocked+=Number(s.last.blocked);check(s.money,3000,'fee once');check(s.conscience,90,'conscience once');check(g.applyBad(s,()=>0),false,'duplicate bad action ignored');}
 check(blocked,(100-failure)*10,'probability threshold '+failure);
}
// All 1,024 combinations of blocked/unblocked random extremes.
for(let mask=0;mask<1024;mask++){
 const s=g.createState('測試委員');
 for(let i=0;i<10;i++){
  check(s.phase,'case','case ready');check(s.index,i,'route position');
  check(g.applyBad(s,()=>((mask>>i)&1)?0.999999:0),true,'action accepted');
  check(s.teachers[i].pain>0,true,'bad intent always adds pain');
  g.advance(s);
  if(i===5){check(s.phase,'reckoning','day-four event');check(s.reckoningSeen,true,'event once');check(s.teachers.some(t=>t.lostJob),true,'day-four has an affected teacher');const money=s.money,conscience=s.conscience;g.continueWork(s);check(s.money,money,'continue no extra money');check(s.conscience,conscience,'continue no extra conscience');}
 }
 check(s.phase,'end','ends Friday');check(s.money,30000,'full route money');check(s.conscience,0,'full route conscience');check(s.teachers.every(t=>t.pain>=0&&t.pain<=100),true,'pain bounded');check(g.applyBad(s),false,'no rewards after ending');check(g.chooseGood(s),false,'no decisions after ending');
}
// Choose conscience at each of the ten schools: stop with no additional money/harm.
for(let stop=0;stop<10;stop++){
 const s=g.createState('良心委員');
 for(let i=0;i<stop;i++){g.applyBad(s,()=>0.99);g.advance(s);if(s.phase==='reckoning')g.continueWork(s);}
 const pain=JSON.stringify(s.teachers.map(t=>t.pain));
 check(g.chooseGood(s),true,'conscience accepted');check(s.phase,'phone','phone immediately');check(s.money,stop*3000,'preserve money');check(s.conscience,100-stop*10,'preserve conscience');check(JSON.stringify(s.teachers.map(t=>t.pain)),pain,'no extra harm');check(g.applyBad(s),false,'cannot reverse good decision');g.finishPhone(s);check(s.phase,'end','phone to ending');check(s.teachers[stop].status,'秉公處理','current teacher protected');check(s.teachers.slice(stop+1).every(t=>t.status==='未到訪'&&t.pain===0),true,'unvisited teachers preserved');
}
{
 const s=g.createState('星期四');for(let i=0;i<6;i++){g.applyBad(s,()=>0.99);g.advance(s);}
 g.chooseGood(s);check(s.endReason,'reckoning','day-four conscience ending');check(s.money,18000,'day-four money');check(s.conscience,40,'day-four conscience');g.finishPhone(s);check(s.phase,'end','day-four jumps to ending');
}
// Every case can return from the phone without duplicate money, harm, or decisions.
for(let stop=0;stop<10;stop++){
 const s=g.createState('回程測試');
 for(let i=0;i<stop;i++){g.applyBad(s,()=>0.99);g.advance(s);if(s.phase==='reckoning')g.continueWork(s);}
 const before=JSON.stringify({money:s.money,conscience:s.conscience,teachers:s.teachers,log:s.log,index:s.index});
 g.chooseGood(s);check(g.resumePhone(s),true,'resume accepted');check(s.phase,'case','resume returns to case');
 check(JSON.stringify({money:s.money,conscience:s.conscience,teachers:s.teachers,log:s.log,index:s.index}),before,'resume preserves all totals and decisions');
 check(g.resumePhone(s),false,'duplicate resume ignored');
 g.applyBad(s,()=>0.99);check(s.money,(stop+1)*3000,'resumed case rewards only once');
}
{const s=g.createState('星期四回程');for(let i=0;i<6;i++){g.applyBad(s,()=>0.99);g.advance(s);}const pain=JSON.stringify(s.teachers);g.chooseGood(s);g.resumePhone(s);check(s.phase,'case','day-four phone continues to seventh school');check(s.index,6,'day-four school position');check(JSON.stringify(s.teachers),pain,'day-four phone does not repeat loss event');}
// V1.6: word banks, balanced random decks, thresholds and fast swipe geometry.
check(g.WORD_BANK.favorable.length,34,'all favorable terms retained');
check(g.WORD_BANK.unfavorable.includes('偏頗摘述'),true,'additional unfavorable synonym retained');
check(g.WORD_BANK.unfavorable.includes('罔顧物證'),true,'physical-evidence synonym retained');
check(g.WORD_BANK.unfavorable.includes('憑空推斷'),true,'additional inference synonym retained');
for(const kind of ['bad','good']){
 const deck=g.makeSliceDeck(kind);check(deck.length,20,'twenty words');check(new Set(deck.map(w=>w.text)).size,20,'no repeated words in round');check(deck.filter(w=>w.target).length,10,'ten targets');
 for(let wave=0;wave<5;wave++){check(deck.filter(w=>w.wave===wave).length,4,'four words per wave');check(deck.filter(w=>w.wave===wave&&w.target).length,2,'two targets per wave');}
 check(deck.filter(w=>w.target).every(w=>g.WORD_BANK[kind==='bad'?'favorable':'unfavorable'].includes(w.text)),true,'correct target category');
}
check(g.slicePassed(6,2),true,'threshold inclusive');check(g.slicePassed(5,0),false,'too few correct');check(g.slicePassed(10,3),false,'too many wrong');check(g.slicePassed(10,0,true),false,'abandon fails');
const rect={x:40,y:40,w:20,h:20};check(g.segmentHitsRect({x:0,y:50},{x:100,y:50},rect),true,'fast horizontal swipe');check(g.segmentHitsRect({x:50,y:0},{x:50,y:100},rect),true,'vertical swipe');check(g.segmentHitsRect({x:0,y:0},{x:100,y:100},rect),true,'diagonal swipe');check(g.segmentHitsRect({x:0,y:20},{x:100,y:20},rect),false,'parallel miss');check(g.segmentHitsRect({x:50,y:50},{x:50,y:50},rect),true,'tap hit');check(g.segmentHitsRect({x:0,y:0},{x:0,y:0},rect),false,'tap miss');
function challenge(s,kind,correct=8,wrong=0){check(g.beginSlice(s,kind,()=>.99),true,'start challenge');if(s.phase==='result'){check(s.last.blocked,true,'administrative gate skips challenge');check(s.slice,null,'no challenge on blocked school');return;}check(g.beginSlice(s,kind),false,'no duplicate start');check(g.completeSlice(s,correct,wrong),true,'score once');check(g.completeSlice(s,10,0),false,'no duplicate scoring');check(g.acceptSlice(s,()=>.99),true,'resolve once');check(g.acceptSlice(s),false,'no duplicate payout');}
{
 const s=g.createState('減薪測試');challenge(s,'bad',5,0);check(s.money,3000,'failure does not reduce current fee');check(s.pendingPenalty,1500,'failure reduces next meeting');g.advance(s);challenge(s,'bad',8,0);check(s.money,4500,'next fee is 1500');check(s.last.income,1500,'report actual reduced fee');check(s.pendingPenalty,0,'penalty lasts one meeting');g.advance(s);challenge(s,'bad',8,0);check(s.money,7500,'fee returns to 3000');
}
for(const pass of [true,false]){
 const s=g.createState('全程切詞');for(let i=0;i<10;i++){challenge(s,'bad',pass?8:0,0);g.advance(s);if(s.phase==='reckoning')challenge(s,'bad',pass?8:0,0);}check(s.money,pass?30000:18000,'full route challenge earnings');check(s.conscience,0,'bad intent still costs conscience');check(s.pendingPenalty,0,'no penalty beyond last meeting');check(s.phase,'end','all meetings terminate');
}
for(let index=0;index<10;index++){
 const s=g.createState('良心失敗');s.index=index;challenge(s,'good',5,0);check(s.phase,'forced-next','good failure cannot reach phone');check(g.finishPhone(s),false,'good failure cannot reach conscience ending');check(s.money,0,'good failure no fee');check(s.conscience,100,'good failure no conscience penalty');check(s.teachers[index].pain,0,'good failure no extra teacher pain');g.advance(s);if(index===9){check(s.endReason,'schedule','last good failure ends by schedule only');}else{check(s.index,index+1,'good failure advances to next school');}
}
{const s=g.createState('誤切');challenge(s,'good',10,3);check(s.phase,'forced-next','wrong cuts force continuation');}
{const s=g.createState('成功');challenge(s,'good',6,2);check(s.phase,'phone','good success reaches phone');g.finishPhone(s);check(s.endReason,'good','success earns conscience ending');}
{const s=g.createState('週四失敗');s.phase='reckoning';s.index=6;s.pendingPenalty=1500;challenge(s,'good',0,0);g.advance(s);check(s.index,6,'day-four failure proceeds to seventh school, does not skip it');check(s.pendingPenalty,1500,'pending fee deduction retained before seventh meeting');}
{const s=g.createState('週四賺錢');s.phase='reckoning';s.index=6;challenge(s,'bad',0,0);check(s.phase,'case','day-four bad challenge continues');check(s.money,0,'special event does not pay twice');check(s.conscience,100,'special event does not deduct twice');check(s.pendingPenalty,1500,'special failure penalizes next meeting');}
check(html.includes('本地圖完全虛構'),false,'map disclaimer removed');
// Administration is sampled once before a bad-choice slicing challenge.
for(const [index,roll,blocked] of [[0,.299,true],[0,.3,false],[4,.999,true],[1,0,false]]){
 const s=g.createState('先把關');s.index=index;let calls=0;
 check(g.beginSlice(s,'bad',()=>{calls++;return roll;}),true,'bad choice accepted');
 check(calls,1,'exactly one administrative draw');check(s.phase,blocked?'result':'slice','gate controls mini-game');
 if(!blocked){g.completeSlice(s,8,0);g.acceptSlice(s,()=>{throw Error('must not redraw administrative gate');});check(s.last.blocked,false,'original gate outcome retained');}
}
{const s=g.createState('前場減薪');s.index=4;s.pendingPenalty=1500;g.beginSlice(s,'bad',()=>.99);check(s.money,1500,'blocked meeting consumes existing penalty');check(s.pendingPenalty,0,'blocked meeting does not create new penalty');check(s.last.challenge,undefined,'no fabricated challenge score');}
{const s=g.createState('良心照常');s.index=4;g.beginSlice(s,'good',()=>{throw Error('good choice has no administrative draw');});check(s.phase,'slice','good challenge still required');}
check(html.match(/<title>(.*?)<\/title>/)[1],'校事委員的一天','clean browser title');
check(html.includes('<p class="subtitle">今天也要發大財</p>'),true,'in-game subtitle restored');
for(const good of [true,false]){
 const s=g.createState('週五質問');s.index=7;g.applyBad(s,()=>.99);const snapshot=JSON.stringify({money:s.money,conscience:s.conscience,teachers:s.teachers,pendingPenalty:s.pendingPenalty});
 rawAdvance(s);check(s.phase,'angry','Friday event occurs before ninth meeting');check(s.index,8,'Friday morning index');check(s.angrySeen,true,'event marked seen');check(g.beginSlice(s,'bad'),false,'event cannot start slicing');
 check(g.resolveAngry(s,good),true,'Friday choice accepted');check(s.phase,good?'end':'case','Friday direct ending or meeting');check(g.resolveAngry(s,good),false,'duplicate Friday action ignored');
 check(JSON.stringify({money:s.money,conscience:s.conscience,teachers:s.teachers,pendingPenalty:s.pendingPenalty}),snapshot,'Friday event preserves all values');
 if(good){check(s.endReason,'good','Friday conscience ending');check(s.teachers[8].status,'未到訪','Friday unvisited teacher stays unvisited');}else{g.applyBad(s,()=>.99);rawAdvance(s);check(s.phase,'case','Friday afternoon no repeated event');}
}
{const s=g.createState('失敗也會遇到');s.index=7;g.beginSlice(s,'good');g.completeSlice(s,0,0);g.acceptSlice(s);rawAdvance(s);check(s.phase,'angry','Friday event follows failed good challenge too');}
// Lightweight DOM adapter checks actual UI render paths and event callbacks.
// This is not a browser or a layout/visual test.
const elements = new Map();
function element(id){if(!elements.has(id))elements.set(id,{id,clientWidth:600,clientHeight:360,setAttribute(k,v){this[k]=v;},appendChild(){},getBoundingClientRect(){return {left:0,top:0};},innerHTML:'',textContent:'',style:{},hidden:false,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);}
const doc={getElementById:element,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
const stored=new Map();
const localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
const browser=vm.createContext({document:doc,localStorage,window:{matchMedia:()=>({matches:false})},console});
vm.runInContext('Math.random=()=>.99;\n'+core+'\n'+ui,browser);
check(element('cover').innerHTML.includes('start-form'),true,'cover form rendered');check(element('cover').innerHTML.includes('校事委員的一天'),true,'cover title');check(element('cover').innerHTML.includes('委員出得去，投訴進得來，校事會議發大財!'),true,'cover subtitle');check(element('cover').innerHTML.includes('required'),true,'nickname is required');check(element('game-layout').hidden,true,'map hidden on cover');check(element('dashboard').hidden,true,'dashboard hidden on cover');
check((element('board').innerHTML.match(/data-school=/g)||[]).length,10,'all ten map buttons');
element('nickname').value='<img onerror=x>';
element('cover').listeners.submit({target:{id:'start-form'},preventDefault(){}});
check(element('panel').innerHTML.includes('&lt;img'),true,'nickname escaped');
check(element('panel').innerHTML.includes('<img onerror'),false,'nickname not executable HTML');
check(element('panel').innerHTML.includes('選擇良心'),true,'updated good-choice label');
check(element('panel').innerHTML.includes('<button class="good" data-action="good"><span>選擇良心</span>'),true,'good button has only requested label');
check(stored.get('school-committee-game.nickname'),'<img onerror','nickname saved locally');
function click(action){doc.listeners.click({target:{closest:()=>({dataset:{action}})}});}
function finishChallenge(context=browser,correct=8,wrong=0){if(vm.runInContext('state.phase',context)==='result')return;check(vm.runInContext('state.phase',context),'slice','challenge must precede resolution');vm.runInContext(`completeSlice(state,${correct},${wrong});render();`,context);click('slice-accept');}
for(let i=0;i<10;i++){click('bad');finishChallenge();check(element('panel').innerHTML.includes('本校調查結果'),true,'result rendered');click('next');if(i===7){check(element('panel').innerHTML.includes('憤怒老師事件'),true,'Friday event renders before school nine');check(element('panel').innerHTML.includes('有老師因為被誣陷'),true,'requested confrontation text');click('friday-continue');check(vm.runInContext('state.index',browser),8,'Friday continues same school');}if(i===5){check(element('panel').innerHTML.includes('那些離開教室的人'),true,'day-four rendered');check(element('panel').innerHTML.includes('<button class="good" data-action="good"><span>選擇良心</span>'),true,'day-four good label and no settlement detail');click('continue');finishChallenge();}}
check(element('settlement').hidden,false,'ending shown');
check((element('settlement').innerHTML.match(/<tr>/g)||[]).length,11,'all ten teacher rows plus header');
check((element('settlement').innerHTML.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,7,'seven safe new-tab sources');
check(element('settlement').innerHTML.includes('30,000'),true,'ending money rendered');
click('restart');check(element('settlement').hidden,true,'restart hides ending');check(element('settlement').innerHTML,'','restart clears ending');check(vm.runInContext('state.phase',browser),'case','restart starts immediately without form');check(vm.runInContext('state.nickname',browser),'<img onerror','restart retains nickname');check(vm.runInContext('state.money',browser),0,'restart resets money');check(vm.runInContext('state.conscience',browser),100,'restart resets conscience');check(element('panel').innerHTML.includes('&lt;img onerror'),true,'restarted nickname remains escaped');
click('good');finishChallenge();check(element('panel').innerHTML.includes('來電顯示'),true,'phone rendered');check(element('panel').innerHTML.includes('&lt;img onerror'),true,'phone uses retained nickname');check(element('panel').innerHTML.includes('data-action="resume-phone"'),true,'phone offers resume');check(element('panel').innerHTML.includes('堅守良心，跳到結算'),true,'phone offers conscience ending');click('resume-phone');check(vm.runInContext('state.phase',browser),'case','phone resumes same school');check(vm.runInContext('state.index',browser),0,'phone does not skip school');check(vm.runInContext('state.teachers[0].status',browser),'未到訪','phone resume does not falsely mark fair decision');click('good');finishChallenge();click('finish');check(element('settlement').innerHTML.includes('一分未賺，良心完整'),true,'early ending rendered');
check(element('settlement').innerHTML.includes('校園瞎搞1／校事會議年花上億公帑　有罪推定調查團月爽撈六位數外快'),true,'CTWANT source present');check(element('settlement').innerHTML.includes('「校事會議的折磨」—范雲沒說的事'),true,'ETtoday source present');check(element('settlement').innerHTML.includes('好老師被逼上絕路 遺孀淚控校長打壓：我很捨不得'),true,'EBC source present');check(element('settlement').innerHTML.includes('為了3.3%不適任教師'),true,'TNL source present');check(element('settlement').innerHTML.includes('moe.gov.tw'),false,'official-response URL removed');element('rules-button').listeners.click();check(element('info-dialog').open,true,'rules opens');element('dialog-close').listeners.click();check(element('info-dialog').open,false,'rules closes');
check(html.includes('application-version" content="V1.6'),true,'V1.6 version marker');
check(html.includes('保留目前良心選項，接聽來電後直接結算'),false,'removed detail absent');
check(html.includes('保留目前金額與良心；來電後跳至週五結算'),false,'day-four detail removed');
click('restart');vm.runInContext("state.index=7;applyBad(state,()=>.99);advance(state);render();",browser);click('friday-good');check(vm.runInContext('state.phase',browser),'end','Friday good button directly settles');check(element('settlement').innerHTML.includes('星期五・上午・憤怒老師事件'),true,'Friday stopping point rendered');
const reloaded=vm.createContext({document:doc,localStorage,window:{matchMedia:()=>({matches:false})},console});
vm.runInContext(core+'\n'+ui,reloaded);
check(element('cover').innerHTML.includes('value="&lt;img onerror"'),true,'reopening pre-fills stored nickname safely');
element('nickname').value='';element('cover').listeners.submit({target:{id:'start-form'},preventDefault(){}});
check(vm.runInContext('state.phase',reloaded),'intro','blank nickname blocks start');
element('cover').listeners.input({target:{id:'nickname',value:'  '}});check(element('start-button').disabled,true,'whitespace disables start');
element('cover').listeners.input({target:{id:'nickname',value:'測試綽號'}});check(element('start-button').disabled,false,'valid nickname enables start');
const denied=vm.createContext({document:doc,localStorage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},window:{matchMedia:()=>({matches:false})},console});
vm.runInContext('Math.random=()=>.99;\n'+core+'\n'+ui,denied);
element('nickname').value='試玩委員';element('cover').listeners.submit({target:{id:'start-form'},preventDefault(){}});click('good');finishChallenge(denied);click('finish');click('restart');
check(vm.runInContext('state.nickname',denied),'試玩委員','storage disabled still retains nickname for restart');
check(/<script[^>]+src=|<link[^>]+href=|<img\b|@import|fetch\(|XMLHttpRequest/.test(html),false,'no network dependencies');
// Deterministic animation/pointer integration; still a DOM substitute, not a browser.
for(const e of elements.values()){e.setAttribute=function(k,v){this[k]=v;};e.appendChild=function(){};e.clientWidth=600;e.clientHeight=360;e.getBoundingClientRect=()=>({left:0,top:0});}
doc.createElement=()=>({dataset:{},style:{},setAttribute(){}});
let animationCallback=null;
denied.requestAnimationFrame=fn=>{animationCallback=fn;return 1;};denied.cancelAnimationFrame=()=>{animationCallback=null;};
click('bad');click('slice-start');
check(vm.runInContext('sliceRun.words.length',denied),4,'animation creates four words');
const target=vm.runInContext('sliceRun.words.find(w=>w.target).rect',denied);
const stage=element('slice-stage');const event=(x,y)=>({pointerId:1,pointerType:'mouse',button:0,isPrimary:true,clientX:x,clientY:y,preventDefault(){}});
stage.listeners.pointerdown(event(0,target.y+target.h/2));stage.listeners.pointermove(event(600,target.y+target.h/2));
check(vm.runInContext('sliceRun.correct',denied),1,'pointer sweep hits flying target');stage.listeners.pointermove(event(0,target.y+target.h/2));check(vm.runInContext('sliceRun.correct',denied),1,'same word cannot score twice');
animationCallback(0);animationCallback(1000);check(vm.runInContext('sliceRun.elapsed',denied),1000,'timer advances');
doc.hidden=true;doc.listeners.visibilitychange();animationCallback(9000);check(vm.runInContext('sliceRun.elapsed',denied),1000,'hidden page pauses timer');
doc.hidden=false;doc.listeners.visibilitychange();animationCallback(10000);animationCallback(13000);check(vm.runInContext('sliceRun.wave',denied),1,'next wave after four active seconds');
animationCallback(29000);check(vm.runInContext('state.phase',denied),'slice-feedback','timer ends challenge');click('slice-accept');check(vm.runInContext('state.pendingPenalty',denied),1500,'timed failure sets next fee penalty');
click('next');click('good');element('slice-dialog').listeners.cancel({preventDefault(){}});check(vm.runInContext('state.sliceReport.abandoned',denied),true,'Escape abandons ready challenge');click('slice-accept');check(vm.runInContext('state.phase',denied),'forced-next','abandoned conscience cannot end');
console.log(`PASS: ${assertions.toLocaleString()} assertions; 1,024 complete routes, ten early exits, day-four exit, probability boundaries, UI render/event smoke tests.`);
