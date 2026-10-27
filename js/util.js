export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dur=(ms,sec)=>{const s=Math.max(0,Math.floor(ms/1000)),p=n=>String(n).padStart(2,'0');return p(Math.floor(s/3600))+':'+p(Math.floor(s%3600/60))+(sec?':'+p(s%60):'')};
export const csvCell=v=>{v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
export const toCsv=rows=>'\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
// id + all descendants (each activity counted once)
export const subtree=(acts,id)=>{const o=new Set([id]);let ch=true;while(ch){ch=false;for(const a of acts)if(a.parentId&&o.has(a.parentId)&&!o.has(a.id)){o.add(a.id);ch=true}}return o};
export const overlaps=(es,s,e,ignore)=>es.some(x=>x.id!==ignore&&s<x.end&&e>x.start);
export const clip=(x,a,b)=>Math.max(0,Math.min(x.end,b)-Math.max(x.start,a));
export const range=(p,off,ws=6,now=new Date())=>{const d=new Date(now);d.setHours(0,0,0,0);let a,b;
 if(p==='day'){d.setDate(d.getDate()+off);a=+d;d.setDate(d.getDate()+1);b=+d}
 else if(p==='week'){d.setDate(d.getDate()-((d.getDay()-ws+7)%7)+off*7);a=+d;d.setDate(d.getDate()+7);b=+d}
 else if(p==='month'){d.setDate(1);d.setMonth(d.getMonth()+off);a=+d;d.setMonth(d.getMonth()+1);b=+d}
 else{d.setMonth(0,1);d.setFullYear(d.getFullYear()+off);a=+d;d.setFullYear(d.getFullYear()+1);b=+d}
 return [a,b]};
// untracked = elapsed time (up to now) in [a,b) not covered by the UNION of entries (overlaps never double-count)
export const untracked=(es,a,b,now=Date.now())=>{b=Math.min(b,now);if(b<=a)return 0;
 const iv=es.map(e=>[Math.max(e.start,a),Math.min(e.end,b)]).filter(x=>x[1]>x[0]).sort((x,y)=>x[0]-y[0]);
 let cov=0,c=null;for(const i of iv){if(!c)c=[...i];else if(i[0]<=c[1])c[1]=Math.max(c[1],i[1]);else{cov+=c[1]-c[0];c=[...i]}}
 if(c)cov+=c[1]-c[0];return b-a-cov};
export const path=(acts,id)=>{const m=new Map(acts.map(a=>[a.id,a])),p=[];let x=m.get(id),n=0;while(x&&n++<50){p.unshift(x.name);x=m.get(x.parentId)}return p.join(' › ')};
