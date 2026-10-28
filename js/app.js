import {auth,db,configured} from './firebase.js';
import {onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,GoogleAuthProvider,signInWithPopup} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {collection,doc,onSnapshot,setDoc,deleteDoc,writeBatch,query,orderBy,limit,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {T} from './i18n.js';
import * as U from './util.js';
import {TPL} from './templates.js';
const S={user:null,acts:[],entries:[],goals:[],cur:null,prefs:{lang:navigator.language.startsWith('ar')?'ar':'en',theme:'dark',weekStart:6},sess:[],curs:[],tab:'act',lvl:null,tl:null,typeFilter:'active',open:new Set(),per:'day',off:0,mode:'list',chartUntr:true,trendG:'day',snap:5,slotH:48,more:'reports',sync:'loading',un:[],rep:{from:'',to:'',act:'',sub:true,notes:true,untr:true},_fc:null};
const $=s=>document.querySelector(s),t=k=>T(S.prefs.lang,k),loc=()=>S.prefs.lang==='ar'?'ar-EG':'en-GB',e=U.esc;
// Prevent dialogs from closing when clicking the backdrop (Cancel / Escape buttons still work via form method=dialog or explicit close)
$('#dlg')?.addEventListener('cancel',ev=>ev.preventDefault());
const col=n=>collection(db,'users',S.user.uid,n),dref=(...p)=>doc(db,'users',S.user.uid,...p);
const toast=m=>{$('#toast').innerHTML=`<span>${e(m)}</span>`;setTimeout(()=>$('#toast').innerHTML='',3000)};
const authErr=x=>{const c=x?.code||'',m=x?.message||String(x);
 if(/auth\/operation-not-allowed|OPERATION_NOT_ALLOWED/i.test(c+m))return t('authDisabled');
 if(/auth\/invalid-api-key|API_KEY_INVALID|api key/i.test(c+m))return t('authBadKey');
 if(/auth\/unauthorized-domain|UNAUTHORIZED_DOMAIN/i.test(c+m))return t('authDomain');
 if(/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found|INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND/i.test(c+m))return t('authBadCred');
 if(/auth\/email-already-in-use|EMAIL_EXISTS/i.test(c+m))return t('authExists');
 if(/auth\/weak-password|WEAK_PASSWORD/i.test(c+m))return t('authWeak');
 if(/auth\/invalid-email|INVALID_EMAIL/i.test(c+m))return t('authBadEmail');
 if(/auth\/too-many-requests/i.test(c+m))return t('authTooMany');
 return m};
const run=async f=>{try{await f()}catch(x){const msg=authErr(x);S.err=msg;toast(msg);draw()}};
const eff=()=>{const n=Date.now(),o=[...S.entries];for(const x of S.sess)x.intervals.forEach((i,k)=>o.push({id:x.id+'_'+k,sid:x.id,activityId:x.activityId,start:i.s,end:i.e??n,note:x.note||'',live:i.e==null}));return o};
const A=id=>S.acts.find(a=>a.id===id);
const ic=(a,c='')=>a?.img?`<img class="ic img ${c}" src="${e(a.img)}" alt="">`:a?.lucide?`<span class="ic ${c}" style="--c:${e(a.color||'#7c5cff')}"><i data-lucide="${e(a.lucide)}"></i></span>`:`<span class="ic emo ${c}">${e(a?.icon||'•')}</span>`;
const nm=id=>A(id)?`${ic(A(id))}<span>${e(A(id).name)}</span>`:'?';
const clean=a=>{const{id,...r}=a;return r};
const kids=p=>S.acts.filter(a=>(a.parentId||null)===p&&!a.archived).sort((a,b)=>(a.order||0)-(b.order||0));
const direct=(a,b)=>{const m={};for(const x of eff()){const d=U.clip(x,a,b);if(d)m[x.activityId]=(m[x.activityId]||0)+d}return m};
const subT=(m,id)=>[...U.subtree(S.acts,id)].reduce((s,i)=>s+(m[i]||0),0); // each descendant counted once
const fd=ts=>new Date(ts).toLocaleDateString(loc(),{weekday:'short',year:'numeric',month:'short',day:'numeric'}),ft=ts=>new Date(ts).toLocaleTimeString(loc(),{hour:'numeric',minute:'2-digit',hour12:true});
const lt=ts=>new Date(ts-new Date(ts).getTimezoneOffset()*6e4).toISOString().slice(0,16);
// ---- dialog form helper
function form(title,fields){return new Promise(res=>{const d=$('#dlg');d.onclick=d.oninput=null;d.innerHTML=`<form method="dialog"><h3>${e(title)}</h3>${fields.map(f=>`<label>${e(f.l)}${f.t==='select'?`<select name="${f.k}">${f.o.map(([v,l])=>`<option value="${e(v)}" ${v==f.v?'selected':''}>${e(l)}</option>`).join('')}</select>`:`<input name="${f.k}" type="${f.t||'text'}" value="${e(f.v??'')}" ${f.r?'required':''}>`}</label>`).join('')}<p><button class="p" value="ok">${t('save')}</button> <button value="x" formnovalidate>${t('cancel')}</button></p></form>`;
 d.onclose=()=>{if(d.returnValue!=='ok')return res(null);const o={};new FormData(d.querySelector('form')).forEach((v,k)=>o[k]=v);res(o)};d.showModal()})}
// ---- subscriptions
function subscribe(){S.un.forEach(f=>f());S.un=[];S.sr=S.lr=false;S.lg=null;const er=x=>{S.sync='error';S.err=x.message;toast(x.message);draw()};
 S.un.push(onSnapshot(col('activities'),s=>{S.acts=s.docs.map(d=>({id:d.id,...d.data()}));S.sync=!navigator.onLine?'offline':(s.metadata.hasPendingWrites?'loading':'synced');if(!s.docs.length&&!s.metadata.fromCache)seed();draw()},er));
 S.un.push(onSnapshot(query(col('timeEntries'),orderBy('start','desc'),limit(3000)),s=>{S.entries=s.docs.map(d=>({id:d.id,...d.data()}));draw()},er));
 S.un.push(onSnapshot(col('goals'),s=>{S.goals=s.docs.map(d=>({id:d.id,...d.data()}));draw()},er));
 S.un.push(onSnapshot(query(col('sessions'),orderBy('startedAt','desc'),limit(500)),s=>{S.sess=s.docs.map(d=>({id:d.id,...d.data()}));S.curs=S.sess.filter(x=>x.status==='running');S.cur=S.curs[0]||null;S.sr=true;S.err='';mig();draw()},er));
 S.un.push(onSnapshot(dref('tracking','current'),s=>{S.lg=s.exists()&&s.data().activityId?s.data():null;S.lr=true;mig()},er)); // legacy single timer -> migrated to a running session once
 S.un.push(onSnapshot(dref('settings','preferences'),s=>{if(s.exists())Object.assign(S.prefs,s.data());draw()},er))}
const DEF=[['sleep','😴','Sleep','النوم'],['food','🍽️','Food','الطعام'],['workout','🏋️','Workout','الرياضة'],['home','🏠','Home','المنزل'],['shopping','🛒','Shopping','التسوق'],['work','💼','Work','العمل'],['studying','📚','Studying','الدراسة'],['reading','📖','Reading','القراءة'],['transport','🚌','Transportation','المواصلات'],['fun','🎮','Entertainment','الاستمتاع'],['social','💬','Social','الاجتماعي'],['care','🧴','Personal Care','العناية الشخصية'],['prayer','🕌','Prayer','العبادة'],['family','👪','Family','العائلة'],['other','⭐','Other','أخرى']];
const seed=()=>run(()=>{const b=writeBatch(db);DEF.forEach((d,i)=>b.set(dref('activities','def_'+d[0]),{name:S.prefs.lang==='ar'?d[3]:d[2],icon:d[1],color:'#0a7be0',parentId:null,order:i,archived:false,description:'',createdAt:serverTimestamp()}));return b.commit()});
const savePref=p=>{Object.assign(S.prefs,p);S.user&&run(()=>setDoc(dref('settings','preferences'),S.prefs));draw()};
// ---- tracking actions (timestamps are canonical; entry id = start ts => retries are idempotent)
const sref=id=>dref('sessions',id),sess=id=>S.sess.find(x=>x.id===id);
// A session = one activity with intervals [{s,e|null}]. Duration = sum of intervals, so paused time is never counted.
const sdur=(x,n=Date.now())=>x.intervals.reduce((a,i)=>a+Math.max(0,(i.e??n)-i.s),0);
const closeIv=(x,at)=>x.intervals.map((i,k)=>k===x.intervals.length-1&&i.e==null?{...i,e:at}:i);
const sput=(x,p)=>setDoc(sref(x.id),{...clean(x),...p,updatedAt:serverTimestamp()});
const mig=()=>{if(!S.sr||!S.lr||!S.lg)return;const c=S.lg;S.lg=null;const b=writeBatch(db);if(!S.sess.some(x=>x.id==='s'+c.start))b.set(sref('s'+c.start),{activityId:c.activityId,status:'running',note:'',intervals:[{s:c.start,e:null}],startedAt:c.start,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});b.delete(dref('tracking','current'));run(()=>b.commit())};
const canStart=at=>{const n=Date.now();if(at>n+6e4)return t('future');return U.overlaps(eff().filter(x=>!x.live),at,Math.max(n,at+1))?t('overlap'):''};
function startSess(aid,at=Date.now(),note=''){at=Math.min(at,Date.now());const m=canStart(at);if(m)return toast(m);const id='s'+at+'_'+Math.random().toString(36).slice(2,7);
 run(()=>setDoc(sref(id),{activityId:aid,status:'running',note,intervals:[{s:at,e:null}],startedAt:at,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))}
const pause=x=>x&&x.status==='running'&&run(()=>sput(x,{status:'paused',intervals:closeIv(x,Date.now())}));
const complete=x=>x&&x.status!=='completed'&&run(()=>sput(x,{status:'completed',intervals:closeIv(x,Date.now())}));
function resume(x){if(!x||x.status!=='paused')return;const n=Date.now();
 run(()=>sput(x,{status:'running',intervals:[...x.intervals,{s:n,e:null}]}))}
const start=id=>{if(S.sess.some(x=>x.status==='running'&&x.activityId===id))return;const p=S.sess.filter(x=>x.status==='paused'&&x.activityId===id).sort((a,b)=>b.startedAt-a.startedAt)[0];p?resume(p):startSess(id)};
const chip=st=>`<span class="chip ${st}">${{running:'●',paused:'❚❚',completed:'✓'}[st]} ${t('st_'+st)}</span>`;
const sAct=x=>(x.status==='running'?`<button data-x="pause:${x.id}">❚❚ ${t('pause')}</button><button data-x="done:${x.id}">✓ ${t('complete')}</button>`:x.status==='paused'?`<button class="p" data-x="res:${x.id}">▶ ${t('resume')}</button><button data-x="done:${x.id}">✓ ${t('complete')}</button>`:'')+`<button data-x="se:${x.id}">✎ ${t('edit')}</button>`+`<button data-x="ss:${x.id}">${t('details')}</button>`;
const sessCard=x=>{const a=A(x.activityId),f=x.intervals[0].s,l=x.intervals.at(-1);return `<div class="card sess ${x.status}"><div class="bar2">${ic(a)}<div class="g"><b>${e(a?.name||'?')}</b> ${chip(x.status)}<div class="mut">${t('startedOn')} ${fd(f)} ${ft(f)}${x.status==='paused'?` · ${t('pausedAt')} ${fd(l.e)} ${ft(l.e)}`:''}${x.status==='completed'?` → ${fd(l.e)} ${ft(l.e)}`:''}</div></div><b class="tt">${U.dur(sdur(x),1)}</b></div><div class="bar2">${sAct(x)}</div></div>`};
const sessList=()=>{const f=S.sf||'all',cnt=k=>S.sess.filter(x=>x.status===k).length,L=S.sess.filter(x=>f==='all'||x.status===f).sort((a,b)=>(b.status==='running')-(a.status==='running')||b.intervals.at(-1).s-a.intervals.at(-1).s).slice(0,30);
 return `<h3 class="sh">${t('sessions')}</h3><div class="tabs">${[['all',t('all')+' '+S.sess.length],['running',t('st_running')+' '+cnt('running')],['paused',t('st_paused')+' '+cnt('paused')],['completed',t('st_completed')+' '+cnt('completed')]].map(([k,l])=>`<button class="${f===k?'on':''}" data-x="sf:${k}">${l}</button>`).join('')}</div>${L.map(sessCard).join('')||`<p class="mut">${t('empty')}</p>`}`};
function sessDialog(id){sessEditDialog(id)}
const sessEdit=x=>x&&sessEditDialog(x.id);
function sessEditDialog(id){
  const d=$('#dlg');d.onclick=d.oninput=d.onchange=d.onclose=null;
  const src=sess(id);if(!src)return;
  // working copy
  let v={activityId:src.activityId,status:src.status,note:src.note||'',intervals:src.intervals.map(i=>({s:i.s,e:i.e??null}))};
  const stMap={paused:'paused',running:'running',completed:'completed'};
  const stLabel={paused:t('st_paused'),running:t('st_running'),completed:t('st_completed')};
  // map UI "stopped" -> completed
  const uiStatus=s=>s==='completed'?'stopped':s;
  const fromUi=s=>s==='stopped'?'completed':s;
  const fmtIv=i=>{const a=new Date(i.s),b=i.e!=null?new Date(i.e):null;
    const f=d=>d.toLocaleString(loc(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return f(a)+' – '+(b?f(b):'…')};
  const ivInput=(i,k)=>`<div class="iv-row" data-ik="${k}"><input type="datetime-local" data-f="s" value="${lt(i.s)}"><span class="mut">–</span><input type="datetime-local" data-f="e" value="${i.e!=null?lt(i.e):''}" ${v.status==='running'&&k===v.intervals.length-1&&i.e==null?'disabled':''}><button type="button" class="d iv-del" data-deliv="${k}" title="${t('del')}">🗑</button></div>`;
  const R=()=>{
    const a=A(v.activityId);
    d.innerHTML=`<form method="dialog" class="sess-edit"><div class="bar2" style="justify-content:space-between"><h3 style="margin:0">${t('editSess')}</h3><button type="button" data-k="x" class="zbtn" title="${t('close')}">✕</button></div>
      <label class="se-lab">${t('status')}</label>
      <div class="tabs se-status">${[['paused',t('st_paused')],['running',t('st_running')],['stopped',t('st_completed')]].map(([k,l])=>`<button type="button" class="${uiStatus(v.status)===k?'on':''}" data-st="${k}">${l}</button>`).join('')}</div>
      <label class="se-lab">${t('act')}</label>
      <select name="aid">${actOpts().map(([k,l])=>`<option value="${e(k)}" ${k===v.activityId?'selected':''}>${e(l)}</option>`).join('')}</select>
      ${v.status==='running'?`<label class="se-lab">${t('from')}</label><input type="datetime-local" name="startNow" value="${lt(v.intervals[0]?.s||Date.now())}">`:''}
      <label class="se-lab">${t('note')}</label>
      <input name="note" value="${e(v.note)}" maxlength="200" placeholder="${t('note')}">
      <label class="se-lab">${t('intervals')}</label>
      <div class="iv-list">${v.intervals.map((i,k)=>ivInput(i,k)).join('')}</div>
      <button type="button" data-addiv="1" class="se-add">＋ ${t('addInterval')}</button>
      <p class="acts" style="margin-top:1rem"><button type="button" class="d" data-k="del">${t('del')}</button><button type="button" data-k="x">${t('cancel')}</button><button class="p" value="ok" data-k="save">${t('save')}</button></p></form>`;
    window.lucide?.createIcons();
  };
  const readDom=()=>{
    const aid=d.querySelector('[name=aid]')?.value;if(aid)v.activityId=aid;
    v.note=d.querySelector('[name=note]')?.value||'';
    const sn=d.querySelector('[name=startNow]');
    d.querySelectorAll('.iv-row').forEach(row=>{
      const k=+row.dataset.ik;if(!v.intervals[k])return;
      const sEl=row.querySelector('[data-f=s]'),eEl=row.querySelector('[data-f=e]');
      if(sEl?.value)v.intervals[k].s=+new Date(sEl.value);
      if(eEl && !eEl.disabled){v.intervals[k].e=eEl.value?+new Date(eEl.value):null}
    });
    if(sn?.value && v.intervals[0])v.intervals[0].s=+new Date(sn.value);
  };
  const applyStatus=st=>{
    readDom();
    const prev=v.status;v.status=fromUi(st);
    const n=Date.now();
    if(v.status==='running'){
      // close others running is handled on save; open last interval
      if(!v.intervals.length)v.intervals=[{s:n,e:null}];
      else{const last=v.intervals.at(-1);if(last.e!=null)v.intervals.push({s:n,e:null});else last.e=null}
    }else{
      // paused or completed: close open interval
      v.intervals=v.intervals.map((i,k)=>k===v.intervals.length-1&&i.e==null?{...i,e:n}:i);
      if(!v.intervals.length)v.intervals=[{s:n-6e5,e:n}];
    }
    R();
  };
  d.onclick=ev=>{
    const b=ev.target.closest('button');if(!b)return;
    const k=b.dataset.k,st=b.dataset.st,deliv=b.dataset.deliv;
    if(k==='x'){d.close();return}
    if(st){applyStatus(st);return}
    if(b.dataset.addiv){readDom();const n=Date.now();v.intervals.push({s:n-18e5,e:n});if(v.status==='running'){v.intervals.forEach((i,idx)=>{if(idx<v.intervals.length-1&&i.e==null)i.e=n});v.intervals.at(-1).e=null}R();return}
    if(deliv!==undefined){readDom();const i=+deliv;if(v.intervals.length<=1)return toast(t('needIv'));v.intervals.splice(i,1);R();return}
    if(k==='del'){if(!confirm(t('confirm')))return;d.close();run(()=>deleteDoc(sref(id)));return}
    if(k==='save'){
      readDom();
      // validate
      for(const i of v.intervals){if(!i.s||(i.e!=null&&i.e<=i.s)){toast(t('bad'));return}}
      if(v.status==='running'){
        // only one open interval at end
        v.intervals=v.intervals.map((i,k)=>k===v.intervals.length-1?{s:i.s,e:null}:{s:i.s,e:i.e??Date.now()});
      }else{
        v.intervals=v.intervals.map(i=>({s:i.s,e:i.e??Date.now()}));
      }
      if(!v.activityId){toast(t('pickType'));return}
      d.close();run(()=>setDoc(sref(id),{activityId:v.activityId,status:v.status,note:v.note,intervals:v.intervals,startedAt:src.startedAt||v.intervals[0].s,updatedAt:serverTimestamp(),createdAt:src.createdAt||serverTimestamp()}));
    }
  };
  d.oninput=ev=>{/* live keep */};
  d.returnValue='';R();if(!d.open)d.showModal();
}
const actOpts=(ex,none)=>[...(none?[['',t('none')]]:[]),...S.acts.filter(a=>!ex||!ex.has(a.id)).map(a=>[a.id,U.path(S.acts,a.id)])];
async function delAct(a){if(!confirm(t('confirm')))return;
 if(S.entries.some(x=>x.activityId===a.id)||S.cur?.activityId===a.id){await run(()=>setDoc(dref('activities',a.id),{...clean(a),archived:true}));return toast(t('hasData'))}
 const b=writeBatch(db);S.acts.filter(c=>c.parentId===a.id).forEach(c=>b.update(dref('activities',c.id),{parentId:a.parentId||null}));b.delete(dref('activities',a.id));run(()=>b.commit())}
// ---- views
const tile=a=>{const k=kids(a.id).length;return `<div class="tile ${S.sess.some(x=>x.status==='running'&&x.activityId===a.id)?'on':''} ${S.sess.some(x=>x.status==='paused'&&x.activityId===a.id)?'pz':''}" draggable="true" data-id="${a.id}" data-x="st:${a.id}" role="button" tabindex="0">${ic(a)}<span class="n">${e(a.name)}</span>${k?`<button class="sub" data-x="lv:${a.id}" title="${k}" aria-label="open"><span class="sub-n">${k}</span><span class="sub-ar">›</span></button>`:''}</div>`};
const todayMs=()=>{const[a,b]=U.range('day',0);return Object.values(direct(a,b)).reduce((x,y)=>x+y,0)};
const streak=()=>{const ds=new Set(eff().map(x=>new Date(x.start).toDateString()));let n=0,d=new Date();if(!ds.has(d.toDateString()))d.setDate(d.getDate()-1);while(ds.has(d.toDateString())){n++;d.setDate(d.getDate()-1)}return n};
const vAct=()=>{const run=S.sess.filter(x=>x.status==='running');
 const hero=run.length?run.map(x=>{const a=A(x.activityId);return `<div class="card sess running" style="margin:0 0 .5rem"><div class="bar2">${ic(a)}<div class="g"><b>${e(a?.name||'?')}</b> ${chip('running')}<div class="mut">${t('startedOn')} ${fd(x.intervals[0].s)} ${ft(x.intervals[0].s)}</div></div><b class="tt" data-tick="${x.id}">${U.dur(sdur(x),1)}</b></div><div class="bar2"><button data-x="pause:${x.id}">❚❚ ${t('pause')}</button><button data-x="done:${x.id}">✓ ${t('complete')}</button><button data-x="se:${x.id}">✎ ${t('edit')}</button></div></div>`}).join(''):`<section class="hero"><h2>${t('welcome')}</h2><div class="mut">${t('sub2')}</div><div class="big">00:00</div><span class="mut">${t('pick')}</span></section>`;
 return `${run.length?`<section class="hero live" style="padding:1rem">${hero}</section>`:hero}<div class="stats"><div class="stat"><span class="mut">${t('today')}</span><b>${U.dur(todayMs())}</b></div><div class="stat"><span class="mut">${t('streak')}</span><b>🔥 ${streak()}</b></div><div class="stat"><span class="mut">${t('acts')}</span><b>${S.acts.filter(a=>!a.archived).length}</b></div></div>${S.lvl&&A(S.lvl)?`<div class="bar2"><button data-x="lv:${A(S.lvl).parentId||''}">‹ ${e(U.path(S.acts,S.lvl))}</button><button class="p" data-x="st:${S.lvl}">▶ ${t('start')}</button></div>`:''}<div class="tiles">${kids(S.lvl&&A(S.lvl)?S.lvl:null).map(tile).join('')}<div class="tile add" data-x="addhere">＋<span class="n">${t('add')}</span></div><div class="tile add" data-x="tpl">✨<span class="n">${t('templates')}</span></div></div><button class="p fab" data-x="newentry" aria-label="${t('manual')}">＋</button>`};
function vTime(){const[a,b]=U.range(S.per,S.off,S.prefs.weekStart),m=direct(a,b),tot=Object.values(m).reduce((x,y)=>x+y,0),un=U.untracked(eff(),a,b),days=Math.max(1,Math.ceil((Math.min(b,Date.now())-a)/864e5));
 const tabs=`<div class="time-filters"><div class="tabs">${[['day','day'],['week','weekW'],['month','month'],['year','year']].map(([p,k])=>`<button class="${S.per===p?'on':''}" data-x="per:${p}">${t(k)}</button>`).join('')}<button data-x="off:-1">‹</button><button data-x="off:1">›</button></div><div class="mut range-lbl">${fd(a)} – ${fd(b-1)}</div><div class="tabs mode-tabs">${['list','chart','trends','stats','cal'].map(p=>`<button class="${S.mode===p?'on':''}" data-x="mode:${p}">${t(p)}</button>`).join('')}</div></div>`;
 let h='';const es=eff().filter(x=>{if(x.live)return x.end>a&&x.start<b;if(S.mode==='list')return x.start>=a&&x.start<b;return x.end>a&&x.start<b}).sort((x,y)=>y.start-x.start);
 if(S.mode==='list'){let last='';const todayKey=new Date().toDateString();h=`<button class="p fab" data-x="newentry" aria-label="${t('manual')}">＋</button><div class="day-list">`+(es.map(x=>{const g=fd(x.start),isToday=new Date(x.start).toDateString()===todayKey,hd=g!==last?`<h4 class="day-sep${isToday?' day-today':''}">${g}</h4>`:'';last=g;return hd+`<div class="row"><span class="g">${nm(x.activityId)}${x.sid?chip(sess(x.sid)?.status||'completed'):''}<div class="mut" style="flex-basis:100%">${ft(x.start)} – ${x.live?'…':ft(x.end)} ${x.note?'· '+e(x.note):''}</div></span><b>${U.dur(x.end-x.start)}</b>${x.sid?`<button data-x="se:${x.sid}">✎</button>`:`<button data-x="ee:${x.id}">✎</button><button class="d" data-x="de:${x.id}">✕</button>`}</div>`}).join('')||`<p class="mut">${t('empty')}</p>`)+`</div>`}
 if(S.mode==='chart'){const rows=kids(null).map(r=>[r,subT(m,r.id)]).filter(r=>r[1]).sort((x,y)=>y[1]-x[1]);const grand=tot+(S.chartUntr?un:0);const base=S.chartUntr?grand:tot||1;
  const rowHtml=(r,v,depth)=>{const pct=Math.round(v/base*100);return `<div class="cl-row${depth?' cl-sub':''}" style="${depth?`padding-inline-start:${.75+depth*.75}rem`:''}"><span class="cl-dot" style="background:${e(r.color||'#7c5cff')}"></span><span class="cl-name">${e(r.name)}</span><span class="cl-pct">${pct}%</span><b>${U.dur(v)}</b></div>`};
  const walk=(parentId,depth)=>{const list=kids(parentId).map(r=>[r,subT(m,r.id)]).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]);let html='';
    for(const[r,v]of list){html+=rowHtml(r,v,depth);const ch=kids(r.id);if(ch.length)html+=walk(r.id,depth+1)}return html};
  h=`<label class="bar2" style="margin:.3rem 0 .5rem;cursor:pointer"><input type="checkbox" data-x="cuntr" ${S.chartUntr?'checked':''}> ${t('showUn')}</label>
  <div class="chart-layout"><div class="chart-canvas"><canvas id="ch"></canvas></div><div class="chart-legend">
  <div class="cl-row cl-total"><span>${t('total')}</span><b>${U.dur(S.chartUntr?grand:tot)}</b></div>
  ${walk(null,0)}
  ${S.chartUntr&&un?`<div class="cl-row"><span class="cl-dot" style="background:#3a4058"></span><span class="cl-name">${t('untracked')}</span><span class="cl-pct">${Math.round(un/base*100)}%</span><b>${U.dur(un)}</b></div>`:''}
  </div></div>`}
 if(S.mode==='trends'){h=`<div class="bar2" style="margin:.3rem 0 .6rem;flex-wrap:wrap"><span class="mut">${t('granularity')}:</span><div class="tabs">${[['day',t('day')],['week',t('weekW')],['month',t('month')]].map(([k,l])=>`<button class="${S.trendG===k?'on':''}" data-x="tg2:${k}">${l}</button>`).join('')}</div></div><div class="trends-wrap"><canvas id="tr"></canvas></div>`}
 if(S.mode==='stats'){const rows=kids(null).map(r=>[r,subT(m,r.id)]).filter(r=>r[1]).sort((x,y)=>y[1]-x[1]);const lg=es.reduce((z,x)=>(x.end-x.start>(z?z.end-z.start:0)?x:z),null);
  h=`<div class="card stats-sum">${t('tracked')}: <b>${U.dur(tot)}</b> · ${t('untracked')}: <b>${U.dur(un)}</b> · ${t('avg')}: <b>${U.dur(tot/days)}</b>${lg?`<br>${t('top')}: ${nm(lg.activityId)} ${U.dur(lg.end-lg.start)}`:''}</div>`+rows.map(([r,v])=>`<div class="card">${nm(r.id)} <b style="float:inline-end">${U.dur(v)} · ${Math.round(v/tot*100)}%</b><div class="bar"><div style="width:${v/tot*100}%"></div></div></div>`).join('')}
 if(S.mode==='cal'){h=`<div class="cal-wrap"><div class="cal-toolbar"><button class="zbtn" data-x="zoom:-1" title="Zoom in"><i data-lucide="zoom-in"></i></button><button class="zbtn" data-x="zoom:1" title="Zoom out" ${S.slotH<=28?'disabled':''}><i data-lucide="zoom-out"></i></button><span class="snap-lab">${t('snap')}:</span><div class="tabs">${[1,5,15].map(m=>`<button class="${S.snap===m?'on':''}" data-x="snap:${m}">${m}m</button>`).join('')}</div></div><div id="fcal" class="fcal"></div></div>`}
 return tabs+h}
function drawChart(){const c=$('#ch');if(!c||!window.Chart)return;const[a,b]=U.range(S.per,S.off,S.prefs.weekStart),m=direct(a,b),r=kids(null).map(x=>[x,subT(m,x.id)]).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]);
 const labels=r.map(x=>x[0].name),data=r.map(x=>+(x[1]/36e5).toFixed(2)),colors=r.map(x=>x[0].color||'#0a7be0');
 if(S.chartUntr){const un=U.untracked(eff(),a,b);if(un>0){labels.push(t('untracked'));data.push(+(un/36e5).toFixed(2));colors.push('#3a4058')}}
 if(window._ch){try{window._ch.destroy()}catch(_){}}
 window._ch=new Chart(c,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>{const sum=i.dataset.data.reduce((a,b)=>a+b,0)||1;const mins=Math.round(i.raw*60);return ` ${i.label}: ${U.dur(mins*6e4)} (${Math.round(i.raw/sum*100)}%)`}}}},cutout:'62%'},
 plugins:[{id:'pctLabels',afterDatasetsDraw(ch){const {ctx}=ch,meta=ch.getDatasetMeta(0),sum=ch.data.datasets[0].data.reduce((a,b)=>a+b,0)||1;meta.data.forEach((arc,i)=>{const v=ch.data.datasets[0].data[i],pct=Math.round(v/sum*100);if(pct<5)return;const pos=arc.tooltipPosition();ctx.save();ctx.fillStyle='#fff';ctx.font='700 12px '+getComputedStyle(document.body).fontFamily;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=3;ctx.fillText(pct+'%',pos.x,pos.y);ctx.restore()})}}]})}
function drawTrends(){const c=$('#tr');if(!c||!window.Chart)return;const[a,b]=U.range(S.per,S.off,S.prefs.weekStart),g=S.trendG||'day';
 const buckets=[];let cur=a;const step=g==='month'?null:g==='week'?7*864e5:864e5;
 if(g==='month'){const d=new Date(a);while(+d<b){const s=+d;d.setMonth(d.getMonth()+1);buckets.push([s,Math.min(+d,b)])}}
 else{while(cur<b){buckets.push([cur,Math.min(cur+step,b)]);cur+=step}}
 const tops=kids(null).map(x=>[x,subT(direct(a,b),x.id)]).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]).slice(0,8).map(x=>x[0]);
 const labels=buckets.map(([s])=>{const d=new Date(s);return g==='month'?d.toLocaleDateString(loc(),{month:'short',year:'2-digit'}):d.toLocaleDateString(loc(),{month:'short',day:'numeric'})});
 const fg=getComputedStyle(document.documentElement).getPropertyValue('--mut')||'#8b93b3';
 const datasets=tops.map(act=>{const col=act.color||'#7c5cff';return{label:act.name,data:buckets.map(([s,e])=>+((subT(direct(s,e),act.id))/36e5).toFixed(2)),backgroundColor:col+'99',borderColor:col,borderWidth:1.5,fill:true,tension:.3,pointRadius:2,pointHoverRadius:4}});
 if(window._tr){try{window._tr.destroy()}catch(_){}}
 window._tr=new Chart(c,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{ticks:{color:fg,maxRotation:0,autoSkipPadding:8},grid:{color:'#ffffff08'}},y:{beginAtZero:true,ticks:{color:fg,callback:v=>v+'h'},grid:{color:'#ffffff10'},title:{display:true,text:'h',color:fg}}},plugins:{legend:{position:'bottom',labels:{color:fg,boxWidth:10,padding:10}},tooltip:{callbacks:{label:i=>` ${i.dataset.label}: ${U.dur(Math.round(i.raw*3600)*1000)}`}}}}})}

function drawCal(){
  const el=$('#fcal');if(!el||!window.FullCalendar)return;
  if(S._fc){try{S._fc.destroy()}catch(_){}S._fc=null}
  const snap=S.snap||5, slotMin=Math.max(22,S.slotH||44);
  el.style.setProperty('--slot-h', slotMin+'px');
  const events=eff().map(x=>{const a=A(x.activityId);return{id:String(x.sid||x.id),title:a?.name||'?',start:new Date(x.start),end:new Date(x.end),backgroundColor:a?.color||'#7c5cff',borderColor:'transparent',textColor:'#fff',extendedProps:{sid:x.sid,eid:x.id,live:!!x.live}}});
  const ws=+S.prefs.weekStart===0?0:+S.prefs.weekStart===1?1:6;
  S._fc=new FullCalendar.Calendar(el,{
    initialView:S.per==='day'?'timeGridDay':'timeGridWeek',
    initialDate:new Date(U.range(S.per==='day'?'day':'week',S.off,S.prefs.weekStart)[0]),
    headerToolbar:false,
    height:'100%',
    expandRows:true,
    slotDuration:{minutes:snap},
    snapDuration:{minutes:snap},
    slotMinTime:'00:00:00',slotMaxTime:'24:00:00',
    slotLabelInterval:'01:00:00',
    slotLabelFormat:{hour:'numeric',minute:'2-digit',omitZeroMinute:true,meridiem:'short'},
    dayHeaderFormat:{weekday:'short',month:'short',day:'numeric'},
    allDaySlot:false,
    nowIndicator:true,
    editable:true,
    eventStartEditable:true,
    eventDurationEditable:true,
    selectable:true,
    selectMirror:true,
    firstDay:ws,
    direction:S.prefs.lang==='ar'?'rtl':'ltr',
    locale:S.prefs.lang==='ar'?'ar':'en',
    events,
    eventClick(info){
      const p=info.event.extendedProps;
      if(p.sid)sessEdit(sess(p.sid));
      else entryDialog(S.entries.find(i=>i.id===p.eid));
    },
    eventDrop(info){saveCalEvent(info.event)},
    eventResize(info){saveCalEvent(info.event)},
    select(sel){
      entryDialog(null,{tab:'type',mode:'done',a:'',date:ymd(+sel.start),st:hm(+sel.start),edate:ymd(+sel.end),et:hm(+sel.end),n:''});
      S._fc.unselect();
    }
  });
  S._fc.render();
}
function saveCalEvent(ev){
  const p=ev.extendedProps,s=+ev.start,en=+ev.end;
  if(p.sid){const x=sess(p.sid);if(!x)return;run(()=>sput(x,{intervals:[{s,e:en}],status:x.status==='running'?'completed':x.status}))}
  else if(p.eid)run(()=>setDoc(dref('timeEntries',p.eid),{...S.entries.find(i=>i.id===p.eid),start:s,end:en,updatedAt:serverTimestamp()}));
}

function prog(g){const[a,b]=U.range(g.period,0,S.prefs.weekStart),m=direct(a,b),v=subT(m,g.activityId)/6e4;return[v,Math.min(100,v/g.target*100)]}
const vGoals=()=>`<button data-x="newgoal">＋ ${t('add')}</button>`+(S.goals.map(g=>{const[v,p]=prog(g);return `<div class="card">${e(g.name)} · ${nm(g.activityId)} <button class="d" data-x="dg:${g.id}" style="float:inline-end">✕</button><div class="bar"><div style="width:${p}%"></div></div><span class="mut">${Math.round(v)} / ${g.target} min (${Math.round(p)}%)</span></div>`}).join('')||`<p class="mut">${t('empty')}</p>`);
const vTypes=()=>{const L=S.tl&&A(S.tl)?S.tl:null,f=S.typeFilter||'active';
 let list=S.acts.filter(a=>L?a.parentId===L:(!a.parentId||!A(a.parentId)));
 if(f==='active')list=list.filter(a=>!a.archived);
 else if(f==='archived')list=list.filter(a=>a.archived);
 list=list.sort((x,y)=>(x.order||0)-(y.order||0));
 const nAct=S.acts.filter(a=>!a.archived).length,nArch=S.acts.filter(a=>a.archived).length;
 const filters=`<div class="tabs">${[['active',t('active')+' '+nAct],['archived',t('archived')+' '+nArch],['all',t('all')+' '+S.acts.length]].map(([k,l])=>`<button class="${f===k?'on':''}" data-x="tf:${k}">${l}</button>`).join('')}</div>`;
 return `${L?`<div class="bar2"><button data-x="tl:${A(L).parentId||''}">‹ ${e(U.path(S.acts,L))}</button></div>`:''}${filters}
 <p class="mut" style="margin:.3rem 0">${t('archHint')}</p>
 <div class="tiles">${list.map(a=>{const k=S.acts.filter(c=>c.parentId===a.id&&(f==='all'||!c.archived===!a.archived||f!=='active')).length;
  return `<div class="tile ${a.archived?'dim archived':''}" data-x="ea:${a.id}" role="button" tabindex="0">${ic(a)}<span class="n">${e(a.name)}</span>
  ${a.archived?`<span class="arch-badge">${t('archived')}</span>`:''}
  <div class="tile-actions">
   <button class="ta" data-x="ar:${a.id}" title="${a.archived?t('unarchive'):t('archive')}">${a.archived?'↩':'📦'}</button>
   ${S.acts.some(c=>c.parentId===a.id)?`<button class="sub" data-x="tl:${a.id}" title="${k}" aria-label="open"><span class="sub-n">${S.acts.filter(c=>c.parentId===a.id).length}</span><span class="sub-ar">›</span></button>`:''}
  </div></div>`}).join('')}
 ${f!=='archived'?`<div class="tile add" data-x="addtl">＋<span class="n">${t('add')}</span></div><div class="tile add" data-x="tpl">✨<span class="n">${t('templates')}</span></div>`:''}
 </div>`};
function report(go){const R=S.rep,from=R.from?+new Date(R.from+'T00:00'):U.range('month',0)[0],to=R.to?+new Date(R.to+'T00:00')+864e5:Date.now();const ids=R.act?(R.sub?U.subtree(S.acts,R.act):new Set([R.act])):null;
 const es=eff().filter(x=>x.end>from&&x.start<to&&(!ids||ids.has(x.activityId))).sort((x,y)=>x.start-y.start);const tot=es.reduce((s,x)=>s+U.clip(x,from,to),0);if(!go)return[es.length,tot];
 const rows=[['record_id','activity_id','activity','path','start_date','start_time','end_date','end_time','seconds','hh:mm:ss',...(R.notes?['note']:[])]];
 const D=ts=>lt(ts).slice(0,10),H=ts=>lt(ts).slice(11);es.forEach(x=>{const s=Math.max(x.start,from),z=Math.min(x.end,to);rows.push([x.id,x.activityId,A(x.activityId)?.name,U.path(S.acts,x.activityId),D(s),H(s),D(z),H(z),Math.round((z-s)/1e3),U.dur(z-s,1),...(R.notes?[x.note||'']:[])])});
 if(R.untr)rows.push(['','','UNTRACKED','','','','','',Math.round(U.untracked(eff(),from,to)/1e3),U.dur(U.untracked(eff(),from,to),1)]);
 if(!es.length&&!R.untr)return toast(t('empty'));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([U.toCsv(rows)],{type:'text/csv;charset=utf-8'}));a.download=`report_${D(from)}_${D(to-1)}.csv`;a.click()}
function vMore(){const tabs=`<div class="tabs">${['reports','settings','account'].map(p=>`<button class="${S.more===p?'on':''}" data-x="mo:${p}">${t(p)}</button>`).join('')}</div>`;
 if(S.more==='reports'){const R=S.rep,[n,tot]=report(0);return tabs+`<div class="card"><label>${t('from')} <input type="date" data-r="from" value="${R.from}"></label> <label>${t('to')} <input type="date" data-r="to" value="${R.to}"></label><p><select data-r="act"><option value="">${t('all')}</option>${actOpts().map(([v,l])=>`<option value="${e(v)}" ${v===R.act?'selected':''}>${e(l)}</option>`).join('')}</select></p>${[['sub','sub'],['notes','notes'],['untr','showUn']].map(([k,l])=>`<label><input type="checkbox" data-r="${k}" ${R[k]?'checked':''}> ${t(l)}</label>`).join('')}<p class="mut">${n} ${t('records')} · ${U.dur(tot)}</p><button class="p" data-x="rep">${t('create')}</button></div>`}
 if(S.more==='settings')return tabs+`<div class="card"><label>${t('lang')} <select data-p="lang"><option value="en" ${S.prefs.lang==='en'?'selected':''}>English</option><option value="ar" ${S.prefs.lang==='ar'?'selected':''}>العربية</option></select></label><p><label>${t('theme')} <select data-p="theme"><option value="dark" ${S.prefs.theme==='dark'?'selected':''}>${t('dark')}</option><option value="light" ${S.prefs.theme==='light'?'selected':''}>${t('light')}</option><option value="system" ${S.prefs.theme==='system'?'selected':''}>${t('system')}</option></select></label></p><label>${t('week')} <select data-p="weekStart">${[6,0,1].map(d=>`<option value="${d}" ${+S.prefs.weekStart===d?'selected':''}>${new Date(2024,0,7+d).toLocaleDateString(loc(),{weekday:'long'})}</option>`).join('')}</select></label></div>`;
 return tabs+`<div class="card">${e(S.user.email||'')}<p class="mut">${t('sync')}: ${S.sync}</p><button data-x="out">${t('signout')}</button></div>`}
function vAuth(){return `<div class="auth card"><div class="brand" style="justify-content:center"><i data-lucide="timer"></i></div><h2>Time Logger</h2><p class="mut">${t('sub2')}</p>${configured?`<input id="em" type="email" placeholder="${t('email')}" autocomplete="email"><input id="pw" type="password" placeholder="${t('pass')}" autocomplete="current-password"><p class="bar2" style="justify-content:center"><button class="p" data-x="li">${t('login')}</button><button data-x="re">${t('register')}</button></p><p class="bar2" style="justify-content:center"><button data-x="rs">${t('reset')}</button><button data-x="go">${t('google')}</button></p>`:`<p>${t('setup')}</p>`}</div>`}
function draw(){const d=document.documentElement;d.lang=S.prefs.lang;d.dir=S.prefs.lang==='ar'?'rtl':'ltr';d.dataset.theme=S.prefs.theme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):S.prefs.theme;
 if(!S.user){$('#app').innerHTML=vAuth();window.lucide?.createIcons();return}
 const tabs=[['act','play'],['time','chart-pie'],['goals','target'],['types','layers'],['more','ellipsis']],V={act:vAct,time:vTime,goals:vGoals,types:vTypes,more:vMore};
 $('#app').innerHTML=`<div class="shell"><aside class="side"><div class="brand"><i data-lucide="timer"></i>Time Logger</div><nav>${tabs.map(([k,i])=>`<button class="${S.tab===k?'on':''}" data-x="tab:${k}"><i data-lucide="${i}"></i><span>${t(k)}</span></button>`).join('')}</nav></aside><section class="page"><header class="top"><h1>${t(S.tab)}</h1><span class="pill ${S.sync}">${t('s_'+S.sync)}</span></header>${S.err?`<div class="banner" data-x="dis">${t('rulesErr')}<br><small>${e(S.err)}</small></div>`:''}<main class="view" ${S.tab==='act'?'':''}>${S.sync==='loading'&&!S.acts.length?'<div class="sk"></div><div class="sk"></div><div class="sk"></div>':V[S.tab]()}</main></section></div>`;
 window.lucide?.createIcons();if(S.tab==='time'&&S.mode==='chart')drawChart();if(S.tab==='time'&&S.mode==='trends')drawTrends();if(S.tab==='time'&&S.mode==='cal')drawCal();bindDnD()}
// ---- icon picker dialog + templates + image upload (96px WebP stored in the activity doc => syncs & persists everywhere)
const toImg=src=>new Promise((ok,no)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;const m=Math.min(i.width,i.height);c.getContext('2d').drawImage(i,(i.width-m)/2,(i.height-m)/2,m,m,0,0,96,96);ok(c.toDataURL('image/webp',.8))};i.onerror=no;i.src=typeof src==='string'?src:URL.createObjectURL(src)});
const LUC='activity airplay alarm-clock album align-center align-left anchor apartment apple archive arrow-down arrow-left arrow-right arrow-up at-sign award baby backpack badge banana banknote barcode bath battery bed beer bell bike binary bluetooth bold book book-marked book-open bookmark bot box briefcase brush bug building building-2 bus cake calculator calendar camera car carrot cast cat chart-bar chart-column chart-line chart-pie check check-circle chef-hat cherry chess church cigarette circle clipboard clock cloud cloud-rain code code-2 coffee cog coins columns command compass computer concierge-bell contact cookie cooking-pot copy credit-card crop cross crown cup-soda database delete diamond dice-5 disc dollar-sign door-closed door-open download droplets drum dumbbell ear earth edit egg euro eye facebook factory fan feather file file-code file-text film filter fingerprint fire flame flashlight flask-conical flower flower-2 focus folder football footprint footprints frown fuel gamepad gamepad-2 gauge gem ghost gift git-branch github glasses globe graduation-cap grape grid-2x2 hammer hand hand-heart hard-drive hash headphones heart heart-handshake heart-pulse help-circle home home-home hourglass house ice-cream image inbox infinity info instagram key keyboard lamp languages laptop layers layout leaf library life-buoy lightbulb link list loader lock log-in log-out luggage mail map map-pin medal megaphone menu message-circle message-square mic microscope milestone milk minimize monitor monitor-play moon moon-star mountain mouse move music navigation network newspaper nut package paintbrush palette paperclip party-popper pause pen pen-line pen-tool pencil percent phone phone-call pie-chart piggy-bank pin pizza plane plane-takeoff play play-circle plug plus pocket pointer popcorn power presentation printer puzzle qr-code quote radio rainbow receipt recycle refresh-cw reply rewind rocket route ruler save scale school scissors screen-share search send server settings share shield ship shirt shopping-bag shopping-cart shovel shower-head shrink sigma signal smartphone smile snowflake sofa soup sparkles speaker spell-check spline split square star sticker store stretch-horizontal stretch-vertical stethoscope sun sunrise sunset swiss-franc sword table tablet tag target tent terminal thermometer thumbs-up ticket timer timer-reset toggle-left tool toolbox toy-brick train tram-front trash tree-deciduous tree-pine trees trophy truck tv type umbrella university upload user user-check user-plus users users-round utensils utensils-crossed variable vegan video video-off voicemail volume wallet wand watch waves webcam wifi wind wine workflow wrench youtube zap zoom-in'.split(' ');
const EMO='😴 🍽️ 🏋️ 📚 💧 🧘 🚶 💼 🎓 ✍️ 🎮 💻 ☕ 🌅 🛒 🚌 👪 🕌 🎬 🧠 🎨 🚴 📱 🌱 ⚽ 🏀 🎸 🎹 🎤 🎧 📖 📝 ✏️ 📌 💡 🔥 ⚡ 🌟 🎯 🏆 🥇 🧩 🧪 🔬 🔭 💊 🏥 💉 🧼 🧴 🪥 🚿 🛁 🚽 🧹 🧺 🛋️ 🛏️ 🪟 🪴 🌸 🌺 🌻 🌼 🍀 🌴 🌲 🌳 🍎 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🌶️ 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🌰 🍞 🥐 🥖 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥙 🧆 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🍯 🥛 🍼 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂'.split(' ');
function actForm(a,pid,tpl,cb){const d=$('#dlg');d.onclick=d.oninput=d.onchange=null;
 const v={name:a?.name||tpl?.name||'',color:a?.color||tpl?.color||'#7c5cff',icon:a?.icon||'',lucide:a?.lucide||tpl?.lucide||(a?'':'star'),img:a?.img||'',pid:a?a.parentId||'':pid||''};
 let tab=v.img?'img':v.icon?'emo':'lib';const ex=a?U.subtree(S.acts,a.id):null;
 const set=(o)=>{Object.assign(v,{icon:'',lucide:'',img:''},o);R()};
 const R=()=>{d.innerHTML=`<form method="dialog"><h3>${t(a?'edit':'add')}</h3><div class="pv">${ic(v)}<input name="name" value="${e(v.name)}" placeholder="${t('name')}" maxlength="80" required></div>
 <label>${t('cat')}<select name="pid">${actOpts(ex,1).map(([k,l])=>`<option value="${e(k)}" ${k===v.pid?'selected':''}>${e(l)}</option>`).join('')}</select></label>
 <label>${t('color')} <input type="color" name="color" value="${v.color}"></label>
 <div class="tabs">${[['lib',t('iconsT')],['emo',t('emojiT')],['img',t('imageT')]].map(([k,l])=>`<button type="button" class="${tab===k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div>
 ${tab==='lib'?`<div class="ig">${LUC.map(n=>`<button type="button" class="${v.lucide===n?'on':''}" data-l="${n}"><i data-lucide="${n}"></i></button>`).join('')}</div>`:tab==='emo'?`<div class="ig">${EMO.map(m=>`<button type="button" data-m="${m}">${m}</button>`).join('')}</div><input name="emo" value="${e(v.icon)}" maxlength="4" placeholder="😀">`:`<div class="bar2" style="flex-direction:column;align-items:stretch;gap:.5rem"><input type="file" accept="image/*" data-f="1"><div class="bar2"><input name="imgurl" type="url" placeholder="${t('imgUrl')}" value="" style="flex:1"><button type="button" data-loadurl="1">${t('load')}</button></div>${v.img?`<button type="button" class="d" data-rm="1">${t('remove')}</button>`:''}</div>`}
 <p class="acts">${a?`<button type="button" data-dup="1" title="${t('dup')}">⧉</button><button type="button" data-arch="1">${a.archived?t('unarchive'):t('archive')}</button><button type="button" class="d" data-del="1">${t('del')}</button>`:''}<button value="x" formnovalidate>${t('cancel')}</button><button class="p" value="ok">${t('save')}</button></p></form>`;window.lucide?.createIcons()};
 d.onclick=ev=>{const b=ev.target.closest('button'),q=b?.dataset;if(!q)return;if(q.dup){d.close();dupAct(a)}else if(q.arch){d.close();toggleArch(a)}else if(q.del){d.close();delAct(a)}else if(q.t){tab=q.t;R()}else if(q.l)set({lucide:q.l});else if(q.m)set({icon:q.m});else if(q.rm)set({lucide:'star'});else if(q.loadurl){const u=d.querySelector('[name=imgurl]')?.value?.trim();if(!u)return toast(t('badUrl'));toImg(u).then(img=>set({img})).catch(()=>toast(t('badUrl')))}};
 d.oninput=ev=>{const n=ev.target.name;if(n==='name')v.name=ev.target.value;else if(n==='pid')v.pid=ev.target.value;else if(n==='color'){v.color=ev.target.value;d.querySelector('.pv .ic')?.style.setProperty('--c',v.color)}else if(n==='emo'){v.icon=ev.target.value;v.lucide='';v.img=''}};
 d.onchange=async ev=>{if(!ev.target.dataset.f)return;const f=ev.target.files[0];if(!f||!f.type.startsWith('image/')||f.size>8e6)return toast('Image only (max 8 MB)');try{set({img:await toImg(f)})}catch{toast('Invalid image')}};
 d.onclose=()=>{if(d.returnValue!=='ok'||!v.name.trim()){cb?.(null);return}const id=a?.id||crypto.randomUUID();cb?.(id);run(()=>setDoc(dref('activities',id),{name:v.name.trim(),icon:v.icon,lucide:v.lucide,img:v.img,color:v.color,parentId:v.pid||null,order:a?.order??S.acts.length,archived:a?.archived||false,description:a?.description||'',createdAt:a?.createdAt||serverTimestamp()}))};
 d.returnValue='';R();if(!d.open)d.showModal()}
const dupAct=a=>run(()=>setDoc(dref('activities',crypto.randomUUID()),{...clean(a),name:a.name+' (copy)',createdAt:serverTimestamp()}));
const toggleArch=async a=>{
  if(!a)return;
  const next=!a.archived;
  const kidsAll=S.acts.filter(c=>c.parentId===a.id);
  const alsoKids=next&&kidsAll.length&&confirm(t('archKids'));
  const b=writeBatch(db);
  b.set(dref('activities',a.id),{...clean(a),archived:next});
  if(alsoKids)kidsAll.forEach(c=>b.set(dref('activities',c.id),{...clean(c),archived:true}));
  await run(()=>b.commit());
  toast(next?t('archivedOk'):t('unarchivedOk'));
};
function tplDialog(){const d=$('#dlg');d.onclick=d.oninput=d.onchange=d.onclose=null;const L=S.prefs.lang==='ar',sel=new Set();let cat='',q='',pid='';
 const items=TPL.map((r,i)=>{const p=r.split('|');return{i,id:'tpl_'+(p[0]+'_'+p[2]).replace(/\W/g,'').toLowerCase(),cat:L?p[1]:p[0],name:L?p[3]:p[2],lucide:p[4],color:p[5]}});
 const cats=[...new Set(items.map(x=>x.cat))],done=x=>S.acts.some(a=>a.id===x.id);
 const grid=()=>{$('#tg').innerHTML=items.filter(x=>(!cat||x.cat===cat)&&x.name.toLowerCase().includes(q)).map(x=>`<div class="tc ${sel.has(x.i)?'sel':''} ${done(x)?'done':''}" data-i="${x.i}">${ic(x)}<b>${e(x.name)}</b><span class="mut">${done(x)?t('added'):e(x.cat)}</span><button class="ed" data-ed="${x.i}" title="${t('customize')}">✎</button></div>`).join('');$('#cn').textContent=sel.size;window.lucide?.createIcons()};
 d.innerHTML=`<h3>✨ ${t('templates')}</h3><input id="q" placeholder="${t('search')}"><div class="chips"><button class="on" data-c="">${t('all')}</button>${cats.map(c=>`<button data-c="${e(c)}">${e(c)}</button>`).join('')}</div><div class="tg" id="tg"></div><label>${t('cat')}<select id="pp">${actOpts(null,1).map(([k,l])=>`<option value="${e(k)}">${e(l)}</option>`).join('')}</select></label><p class="acts"><button data-x2="x">${t('cancel')}</button><button class="p" data-x2="add">${t('addN')} (<span id="cn">0</span>)</button></p>`;
 d.onclick=ev=>{const b=ev.target.closest('button'),c=ev.target.closest('.tc');
  if(b?.dataset.ed!==undefined){const x=items[+b.dataset.ed];d.close();return actForm(null,pid,x)}
  if(b?.dataset.c!==undefined){cat=b.dataset.c;d.querySelectorAll('.chips button').forEach(k=>k.classList.toggle('on',k===b));return grid()}
  if(b?.dataset.x2==='x')return d.close();
  if(b?.dataset.x2==='add'){if(!sel.size)return;const bt=writeBatch(db);sel.forEach(i=>{const x=items[i];if(done(x))return;bt.set(dref('activities',x.id),{name:x.name,icon:'',lucide:x.lucide,img:'',color:x.color,parentId:pid||null,order:S.acts.length+i,archived:false,description:'',createdAt:serverTimestamp()})});return run(()=>bt.commit().then(()=>{toast('✓');d.close()}))}
  if(c&&!c.classList.contains('done')){const i=+c.dataset.i;sel.has(i)?sel.delete(i):sel.add(i);grid()}};
 d.oninput=ev=>{if(ev.target.id==='q'){q=ev.target.value.toLowerCase();grid()}else if(ev.target.id==='pp')pid=ev.target.value};
 d.showModal();grid()}
// ---- entry dialog: Running (start now/at a past time) or Completed (start + end date/time). Tabs: Time / Type / Details.
const hm=ts=>{const d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const ymd=ts=>lt(ts).slice(0,10);
const span=v=>[+new Date(v.date+'T'+v.st),+new Date((v.edate||v.date)+'T'+(v.et||v.st))];
function entryDialog(en,v){const d=$('#dlg');d.onclick=d.oninput=d.onchange=d.onclose=null;const now=Date.now(),t0=now-18e5;
 v=v||{tab:en?'det':'time',mode:en?(en.status==='running'?'run':en.status==='paused'?'pause':'done'):'run',a:en?.activityId||'',date:ymd(en?.start??t0),st:hm(en?.start??t0),edate:ymd(en?.end??now),et:hm(en?.end??now),n:en?.note||''};
 const ro=v.mode==='run',run_=ro&&!en,pz=v.mode==='pause',rc=[],seen=new Set();for(const x of S.entries){const k=x.activityId+'|'+(x.note||'');if(!seen.has(k)&&A(x.activityId)){seen.add(k);rc.push(x)}if(rc.length>=6)break}
 const dur=()=>{const[s,x]=span(v);return ro?U.dur(Math.max(0,Date.now()-s)):U.dur(x-s)};
 const setEnd=ms=>{v.edate=ymd(ms);v.et=hm(ms)};
 const row=(k,l)=>`<div class="fr"><label>${l}<input type="time" name="${k}" value="${v[k]}" required></label><span class="bar2"><button type="button" data-now="${k}">${t('now')}</button><button type="button" data-adj="${k}:-5">−5</button><button type="button" data-adj="${k}:5">+5</button></span></div>`;
 const P={time:()=> (en?`<div class="fr"><label>${t('from')}<input type="date" name="date" value="${v.date}" required></label><label>${t('from')}<input type="time" name="st" value="${v.st}" required></label></div>${ro?'':`<div class="fr"><label>${t(pz?'pausedAt':'to')}<input type="date" name="edate" value="${v.edate}" required></label><label>${t(pz?'pausedAt':'to')}<input type="time" name="et" value="${v.et}" required></label></div>`}`:row('st',t('from'))+(ro?'':row('et',t(pz?'pausedAt':'to'))))+(ro?'':`<label>${t('duration')}<input name="du" id="du" value="${dur()}" inputmode="numeric" pattern="\\d{1,3}:[0-5]\\d" style="width:7rem"></label><div class="chips">${[15,30,60,120].map(m=>`<button type="button" data-q="${m}">${m<60?m+'m':m/60+'h'}</button>`).join('')}</div>`)+(rc.length&&!en?`<label>${t('recent')}</label><div class="chips">${rc.map((x,i)=>`<button type="button" data-rc="${i}">${e(A(x.activityId).name)}${x.note?' · '+e(x.note.slice(0,14)):''}</button>`).join('')}</div>`:''),
 type:()=>`<div class="tiles sm" style="max-height:46vh;overflow:auto">${S.acts.filter(a=>!a.archived||a.id===v.a).sort((x,y)=>(x.order||0)-(y.order||0)).map(a=>`<div class="tile ${v.a===a.id?'on':''}" data-a="${a.id}" title="${e(U.path(S.acts,a.id))}" role="button" tabindex="0">${ic(a)}<span class="n">${e(a.name)}</span></div>`).join('')}<div class="tile add" data-nt="1">＋<span class="n">${t('newType')}</span></div></div>`,
 det:()=>`<div class="fr"><label>${t('from')}<input type="date" name="date" value="${v.date}" required></label><label>${t('from')}<input type="time" name="st" value="${v.st}" required></label></div>${ro?'':`<div class="fr"><label>${t(pz?'pausedAt':'to')}<input type="date" name="edate" value="${v.edate}" required></label><label>${t(pz?'pausedAt':'to')}<input type="time" name="et" value="${v.et}" required></label></div>`}<label>${t('note')}<input name="n" value="${e(v.n)}" maxlength="200" placeholder="${t('note')}"></label><div class="pv">${A(v.a)?ic(A(v.a))+`<b>${e(A(v.a).name)}</b>`:`<span class="mut">${t('pickType')}</span>`}<span class="mut">${dur()}</span></div>`};
 const chk=()=>{if(!A(v.a)){v.tab='type';R();return t('pickType')}if(!v.date||!v.st)return t('bad');const[s,x]=span(v);if(run_)return canStart(s);if(ro){const n=Date.now();return s>n+6e4?t('future'):U.overlaps(eff().filter(z=>z.sid!==en?.sid),s,n)?t('overlap'):''}if(!v.et||!(x>s))return t('bad');if(x>Date.now()+6e4)return t('future');if(U.overlaps(eff().filter(z=>z.sid!==en?.sid&&z.id!==en?.id),s,x))return t('overlap')};
 const R=()=>{d.innerHTML=`<form method="dialog"><h3>${t(en?'editEntry':run_?'startAct':'newEntry')}<span class="badge ${en?'old':'new'}">${t(en?'recorded':'newB')}</span></h3>${en?'':`<div class="tabs">${[['run',t('modeRun')],['pause',t('modePause')],['done',t('modeDone')]].map(([k,l])=>`<button type="button" class="${v.mode===k?'on':''}" data-m="${k}">${l}</button>`).join('')}</div>`}<div class="tabs">${[['time',t('tTime')],['type',t('tType')],['det',t('tDet')]].map(([k,l])=>`<button type="button" class="${v.tab===k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div><div>${P[v.tab]()}</div><p class="acts">${en?.sid&&false?'':en&&!en.sid?`<button type="button" class="d" data-dl="1">${t('del')}</button>`:''}<button value="x" formnovalidate>${t('cancel')}</button><button class="p" value="ok">${t(run_?'startB':'save')}</button></p></form>`;
  d.querySelector('form').onsubmit=ev=>{if(ev.submitter?.value!=='ok')return;const m=chk();if(m){ev.preventDefault();toast(m)}};window.lucide?.createIcons()};
 d.onclick=ev=>{const el=ev.target.closest('button,[data-a],[data-nt]'),q=el?.dataset;if(!q)return;
  if(q.t){v.tab=q.t;R()}else if(q.m){v.mode=q.m;entryDialog(en,v)}else if(q.a){v.a=q.a;R()}
  else if(q.now){const n=Date.now();if(q.now==='st'){v.date=ymd(n);v.st=hm(n)}else setEnd(n);R()}
  else if(q.adj){const[k,m]=q.adj.split(':'),[s,x]=span(v);if(k==='st'){const ms=s+m*6e4;v.date=ymd(ms);v.st=hm(ms)}else setEnd(x+m*6e4);R()}
  else if(q.q){setEnd(span(v)[0]+q.q*6e4);R()}
  else if(q.rc){const x=rc[+q.rc];v.a=x.activityId;v.n=x.note||'';setEnd(span(v)[0]+Math.max(6e4,x.end-x.start));R()}
  else if(q.nt){v.tab='type';actForm(null,'',null,id=>{if(id)v.a=id;setTimeout(()=>entryDialog(en,v),250)})}
  else if(q.dl&&confirm(t('confirm'))){d.close();run(()=>deleteDoc(dref('timeEntries',en.id)))}};
 d.oninput=ev=>{const n=ev.target.name;if(['st','et','date','edate','n'].includes(n)){if(n==='date'&&v.edate===v.date)v.edate=ev.target.value;v[n]=ev.target.value;const du=d.querySelector('#du');if(du&&n!=='n')du.value=dur()}};
 d.onchange=ev=>{if(ev.target.name!=='du')return;const m=/^(\d{1,3}):([0-5]\d)$/.exec(ev.target.value);if(m){setEnd(span(v)[0]+(+m[1]*60+ +m[2])*6e4);R()}};
 d.onclose=()=>{if(d.returnValue!=='ok')return;const[s,x]=span(v),note=v.n.trim();
  if(run_)return startSess(v.a,s,note);
  if(en?.sid)return run(()=>sput(sess(en.sid),{activityId:v.a,note,intervals:[{s,e:ro?null:x}],status:en.status}));
  if(en)return run(()=>setDoc(dref('timeEntries',en.id),{activityId:v.a,start:s,end:x,note,createdAt:en.createdAt||serverTimestamp(),updatedAt:serverTimestamp()}));
  run(()=>setDoc(sref('s'+s),{activityId:v.a,status:pz?'paused':'completed',note,intervals:[{s,e:x}],startedAt:s,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))};
 d.returnValue='';R();if(!d.open)d.showModal()}
// ---- events

function bindDnD(){
  const root=document.querySelector('.tiles');if(!root)return;
  let dragId=null,dragged=false;
  root.querySelectorAll('.tile[draggable]').forEach(el=>{
    el.addEventListener('dragstart',ev=>{dragId=el.dataset.id;dragged=false;el.classList.add('dragging');ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',dragId)});
    el.addEventListener('drag',()=>{dragged=true});
    el.addEventListener('dragend',()=>{el.classList.remove('dragging');root.querySelectorAll('.tile').forEach(x=>x.classList.remove('drag-over'));if(dragged)setTimeout(()=>dragged=false,50)});
    el.addEventListener('dragover',ev=>{ev.preventDefault();ev.dataTransfer.dropEffect='move';el.classList.add('drag-over')});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',ev=>{ev.preventDefault();el.classList.remove('drag-over');const to=el.dataset.id;if(!dragId||dragId===to)return;dragged=true;
      const list=kids(S.lvl&&A(S.lvl)?S.lvl:null);const ids=list.map(a=>a.id);const from=ids.indexOf(dragId),ti=ids.indexOf(to);if(from<0||ti<0)return;
      ids.splice(from,1);ids.splice(ti,0,dragId);
      const b=writeBatch(db);ids.forEach((id,i)=>b.update(dref('activities',id),{order:i}));run(()=>b.commit());
    });
    el.addEventListener('click',ev=>{if(dragged){ev.preventDefault();ev.stopImmediatePropagation();dragged=false}},true);
  });
}
document.addEventListener('click',async ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x)return;const[k,v]=x.split(/:(.*)/);
 const H={tpl:()=>tplDialog(),dup:()=>run(()=>setDoc(dref('activities',crypto.randomUUID()),{...clean(A(v)),name:A(v).name+' (copy)',createdAt:serverTimestamp()})),tab:()=>{S.tab=v;draw()},tg:()=>{S.open.has(v)?S.open.delete(v):S.open.add(v);draw()},st:()=>start(v),pause:()=>pause(sess(v)),done:()=>complete(sess(v)),res:()=>resume(sess(v)),ss:()=>sessDialog(v),se:()=>sessEdit(sess(v)),sf:()=>{S.sf=v;draw()},dis:()=>{S.err='';draw()},ch:()=>actForm(null,v),newact:()=>actForm(null,''),per:()=>{S.per=v;S.off=0;draw()},off:()=>{S.off+=+v;draw()},mode:()=>{S.mode=v;draw()},cuntr:()=>{S.chartUntr=!S.chartUntr;draw()},tg2:()=>{S.trendG=v;draw()},snap:()=>{S.snap=+v;draw()},zoom:()=>{S.slotH=Math.max(28,Math.min(80,(S.slotH||48)+(+v)*8));draw()},newentry:()=>entryDialog(),ee:()=>entryDialog(S.entries.find(i=>i.id===v)),lv:()=>{S.lvl=v||null;draw()},tl:()=>{S.tl=v||null;draw()},tf:()=>{S.typeFilter=v;draw()},addhere:()=>actForm(null,S.lvl||''),addtl:()=>actForm(null,S.tl||''),de:()=>confirm(t('confirm'))&&run(()=>deleteDoc(dref('timeEntries',v))),
 newgoal:async()=>{const o=await form(t('goal'),[{k:'name',l:t('name'),r:1},{k:'a',l:t('act'),t:'select',o:actOpts()},{k:'p',l:t('period'),t:'select',o:[['day',t('day')],['week',t('weekW')],['month',t('month')]]},{k:'m',l:t('target'),t:'number',v:60,r:1}]);o&&run(()=>setDoc(dref('goals',crypto.randomUUID()),{name:o.name,activityId:o.a,period:o.p,target:+o.m,status:'active'}))},dg:()=>confirm(t('confirm'))&&run(()=>deleteDoc(dref('goals',v))),
 ea:()=>actForm(A(v)),ar:()=>toggleArch(A(v)),da:()=>delAct(A(v)),mo:()=>{S.more=v;draw()},rep:()=>report(1),out:()=>signOut(auth),
 li:()=>{const em=$('#em').value.trim(),pw=$('#pw').value;if(!em||!pw)return toast(t('authNeed'));run(()=>signInWithEmailAndPassword(auth,em,pw))},re:()=>{const em=$('#em').value.trim(),pw=$('#pw').value;if(!em||!pw)return toast(t('authNeed'));if(pw.length<6)return toast(t('authWeak'));run(()=>createUserWithEmailAndPassword(auth,em,pw))},rs:()=>{const em=$('#em').value.trim();if(!em)return toast(t('authNeed'));run(async()=>{await sendPasswordResetEmail(auth,em);toast('✓')})},go:()=>run(()=>signInWithPopup(auth,new GoogleAuthProvider()))};H[k]?.()});
document.addEventListener('change',ev=>{const p=ev.target.dataset.p,r=ev.target.dataset.r;if(p)savePref({[p]:p==='weekStart'?+ev.target.value:ev.target.value});if(r){S.rep[r]=ev.target.type==='checkbox'?ev.target.checked:ev.target.value;draw()}});
setInterval(()=>{for(const x of (S.curs||S.sess.filter(s=>s.status==='running'))){const el=document.querySelectorAll(`[data-tick="${CSS.escape(x.id)}"]`);el.forEach(n=>n.textContent=U.dur(sdur(x),1))}},1000);
if(configured)onAuthStateChanged(auth,u=>{S.un.forEach(f=>f());S.user=u;if(u)subscribe();else{S.acts=[];S.entries=[];S.sess=[];S.curs=[];S.cur=null;draw()}});else draw();

addEventListener('offline',()=>{S.sync='offline';draw()});addEventListener('online',()=>{S.sync='loading';draw()});matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>S.prefs.theme==='system'&&draw());
document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('[role=button]')){ev.preventDefault();ev.target.click()}});
