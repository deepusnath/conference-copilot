// App logic. Content/data lives in seed-data.js.
const KEY="cqe-conf-tracker-v2";
let sb=null,sbUser=null,pushTimer=null; // cloud state — declared early: save() may run during initial load
// ---- researcher profile state (#14) + keyword matching engine (#15) ----
const PKEY="cqe-profile-v1";
let prof=null;
try{ prof=JSON.parse(localStorage.getItem(PKEY))||null }catch(e){}
if(!prof||!Array.isArray(prof.workstreams)) prof=structuredClone(DEFAULT_PROFILE);
let RO=false; // read-only share view
function saveProf(){ if(RO) return; try{localStorage.setItem(PKEY,JSON.stringify(prof))}catch(e){} if(typeof pushCloud==="function") pushCloud(); }
function wsGet(w){ return prof.workstreams.find(x=>x.w===w)||prof.workstreams[0]; }
function computeFits(c){
  const out=new Set((c.fits||[]).filter(w=>prof.workstreams.some(x=>x.w===w)));
  const text=(c.acr+" "+c.name+" "+(c.why||"")+" "+(c.city||"")).toLowerCase();
  const kw={};
  prof.workstreams.forEach(ws=>{
    const hits=(ws.keywords||[]).filter(k=>text.includes(k.toLowerCase()));
    if(hits.length){ out.add(ws.w); if(!(c.fits||[]).includes(ws.w)) kw[ws.w]=hits; }
  });
  c.__kw=kw;
  return [...out].sort();
}
function profText(){
  return `${prof.name} \u2014 ${prof.headline}. Thesis: ${prof.thesis}. ${prof.guidance}`;
}
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
let data;
try{ data=JSON.parse(localStorage.getItem(KEY))||null }catch(e){ data=null }
if(!data){ data=structuredClone(SEED); save(); }
else{ const known=new Map(data.map(c=>[c.id,c])); let changed=false;
  SEED.forEach(s=>{
    const cur=known.get(s.id);
    if(!cur){ data.push(structuredClone(s)); changed=true; }
    else{ // sync curated metadata into stored copies without touching user fields
      if(JSON.stringify(cur.fits||null)!==JSON.stringify(s.fits||null)){ cur.fits=s.fits; changed=true; }
      if((cur.kind||null)!==(s.kind||null)){ cur.kind=s.kind; changed=true; }
      if(cur.tier!==s.tier){ cur.tier=s.tier; changed=true; }
    }
  });
  if(changed) save(); }

function save(){ if(RO) return; try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){} if(typeof pushCloud==="function") pushCloud(); }
function days(d){ if(!d) return null; return Math.round((new Date(d+"T00:00:00")-TODAY)/864e5) }
function fmt(d){ if(!d) return "TBA"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) }
function urg(n){ if(n===null) return {cls:"",label:"date TBA"}; if(n<0) return {cls:"",label:"closed"}; if(n<=7) return {cls:"crit",label:n+"d left — critical"}; if(n<=21) return {cls:"warn",label:n+"d left"}; return {cls:"good",label:n+"d left"} }
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])) }

const DRILLS={
  open:{label:"open deadlines",test:c=>!["missed","skipped","rejected","presented"].includes(c.status)&&days(c.dl)!==null&&days(c.dl)>=0},
  closing21:{label:"closing within 21 days",test:c=>!["missed","skipped","rejected","presented"].includes(c.status)&&days(c.dl)!==null&&days(c.dl)>=0&&days(c.dl)<=21},
  subs:{label:"submitted / under review",test:c=>["submitted","under review"].includes(c.status)},
  acc:{label:"accepted or registered",test:c=>["accepted","registered"].includes(c.status)}
};
let tileFilter=null;
function renderDash(){
  const open=data.filter(DRILLS.open.test);
  const critN=data.filter(DRILLS.closing21.test).length;
  const sub=data.filter(DRILLS.subs.test).length;
  const acc=data.filter(DRILLS.acc.test).length;
  const missed=data.filter(c=>c.status==="missed");
  document.getElementById("tiles").innerHTML=
    tile(open.length,"open deadlines in the pipeline","","open")+
    tile(critN,"closing within 21 days",critN?"crit":"","closing21")+
    tile(sub,"submitted / under review",sub?"good":"","subs")+
    tile(acc,"accepted or registered",acc?"good":"","acc");
  const soon=[...open].sort((a,b)=>days(a.dl)-days(b.dl)).slice(0,10);
  document.getElementById("soonList").innerHTML=soon.map(row).join("")||emptyRow("Nothing open — run the scout.");
  document.getElementById("missedList").innerHTML=missed.map(row).join("")||emptyRow("Nothing missed. Keep it that way.");
  document.querySelectorAll("#tiles button.tile").forEach(b=>b.addEventListener("click",()=>drillFilter(b.dataset.drill)));
  document.querySelectorAll(".dl-row.link").forEach(r=>r.addEventListener("click",()=>drillToConf(r.dataset.id)));
}
function tile(n,l,cls,drill){ return `<button type="button" class="tile ${cls}" data-drill="${drill}" aria-label="Show ${l} in pipeline"><div class="n">${n}</div><div class="l">${l}</div><div class="go">view in pipeline →</div></button>` }
function emptyRow(t){ return `<div class="dl-row"><div class="who"><span class="m">${t}</span></div></div>` }
function row(c){
  const u=urg(days(c.dl));
  return `<div class="dl-row link" data-id="${c.id}" role="button" tabindex="0" aria-label="Open ${esc(c.acr)} in pipeline">
    <span class="date mono">${fmt(c.dl)}</span>
    <span class="who"><b>${esc(c.acr)}</b> <span class="m">· ${esc(c.city)}${c.approx?" · ":""}</span>${c.approx?'<span class="verify">verify</span>':""}</span>
    <span class="pill acc">${esc(c.status)}</span>
    <span class="pill ${u.cls}">${u.label}</span>
  </div>`;
}
function switchTab(name){
  document.querySelectorAll("nav.tabs button").forEach(x=>x.setAttribute("aria-selected",x.dataset.tab===name||(name==="match"&&x.dataset.tab==="prof")));
  ["dash","pipe","prof","play","match"].forEach(t=>document.getElementById("tab-"+t).hidden=(name!==t));
}
function renderMatch(w){
  const ws=wsGet(w);
  document.getElementById("matchTitle").textContent="Venue matches \u2014 "+ws.label+": "+ws.short;
  document.getElementById("matchNote").textContent=ws.matchNote||"";
  const list=data.filter(c=>computeFits(c).includes(w));
  document.getElementById("matchList").innerHTML=groupedCards(list,"");
  list.forEach(c=>{ const hits=c.__kw&&c.__kw[w];
    if(hits){ const el=document.querySelector("#matchList #conf-"+CSS.escape(c.id)+" .why");
      if(el) el.innerHTML+=` <span class="verify">keyword match: ${esc(hits.join(", "))}</span>`; } });
  bindCards("#matchList",()=>renderMatch(w));
  switchTab("match"); window.scrollTo({top:0});
}
function drillFilter(key){
  tileFilter=key;
  document.getElementById("q").value=""; document.getElementById("fTier").value=""; document.getElementById("fStatus").value="";
  switchTab("pipe"); renderPipe(); window.scrollTo({top:0});
}
function drillToConf(id){
  tileFilter=null;
  document.getElementById("q").value=""; document.getElementById("fTier").value=""; document.getElementById("fStatus").value="";
  switchTab("pipe"); renderPipe();
  const el=document.getElementById("conf-"+id);
  if(el){ el.scrollIntoView({block:"center"}); el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),1700); }
}
function renderPipe(){
  const q=(document.getElementById("q").value||"").toLowerCase();
  const ft=document.getElementById("fTier").value, fs=document.getElementById("fStatus").value;
  const list=data.filter(c=>
    (!tileFilter||DRILLS[tileFilter].test(c))&&
    (!q||`${c.acr} ${c.name} ${c.city} ${c.why}`.toLowerCase().includes(q))&&
    (!ft||String(c.tier)===ft)&&(!fs||c.status===fs));
  document.getElementById("pipeList").innerHTML=groupedCards(list,
    tileFilter?`<div class="chipbar"><span class="m" style="color:var(--muted);font-size:13px">Showing</span><span class="pill acc">${DRILLS[tileFilter].label} (${list.length})<button type="button" aria-label="Clear filter" id="clearDrill">✕</button></span></div>`:"");
  const cd=document.getElementById("clearDrill");
  if(cd) cd.addEventListener("click",()=>{ tileFilter=null; renderPipe(); });
  bindCards("#pipeList",renderPipe);
}
function groupedCards(list,prefix){
  const byTier={1:[],2:[],3:[],4:[]};
  list.forEach(c=>byTier[c.tier]?.push(c));
  let html=prefix||"";
  for(const t of [1,2,3,4]){
    const arr=byTier[t]; if(!arr.length) continue;
    arr.sort((a,b)=>{const da=days(a.dl),db=days(b.dl);const ka=da===null?9e9:(da<0?8e9:da),kb=db===null?9e9:(db<0?8e9:db);return ka-kb});
    html+=`<div class="group-h">${TIERS[t]}</div>`+arr.map(card).join("");
  }
  return list.length?html:html+`<p style="color:var(--muted)">No matches.</p>`;
}
function bindCards(root,rerender){
  const R=document.querySelector(root);
  R.querySelectorAll(".conf select.status").forEach(s=>s.addEventListener("change",e=>{
    const c=data.find(x=>x.id===e.target.dataset.id); if(c){c.status=e.target.value;save();renderDash();rerender();}
  }));
  R.querySelectorAll(".conf textarea").forEach(t=>t.addEventListener("change",e=>{
    const c=data.find(x=>x.id===e.target.dataset.id); if(c){c.notes=e.target.value;save();}
  }));
  R.querySelectorAll(".conf .draft").forEach(b=>b.addEventListener("click",e=>openDraft(e.target.dataset.id,false)));
  R.querySelectorAll(".conf .subm").forEach(b=>b.addEventListener("click",e=>openDraft(e.target.dataset.id,true)));
  R.querySelectorAll(".conf .del").forEach(b=>b.addEventListener("click",e=>{
    const c=data.find(x=>x.id===e.target.dataset.id);
    if(c&&confirm(`Remove ${c.acr} from the pipeline?`)){ data=data.filter(x=>x.id!==c.id); save(); renderDash(); rerender(); }
  }));
}
function card(c){
  const u=urg(days(c.dl));
  const j=c.kind==="journal";
  return `<div class="conf" id="conf-${c.id}">
    <div class="top"><span class="acr">${esc(c.acr)}</span><span class="name">${esc(c.name)}</span>
      ${computeFits(c).map(w=>`<span class="tag">W${w}</span>`).join("")}
      <span class="tag ${c.tier===1?"t1":""}">${j?"Journal":"Tier "+c.tier}</span></div>
    <div class="meta">
      <span>${esc(c.city)}</span>
      ${j?'<span class="pill">rolling submissions</span>':`<span class="mono">event ${fmt(c.event)}</span>
      <span class="mono">deadline ${fmt(c.dl)}${c.approx?" ":""}</span>${c.approx?'<span class="verify">verify</span>':""}
      <span class="pill ${u.cls}">${u.label}</span>`}
      ${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener">site ↗</a>`:""}
      <span style="color:var(--faint)">via ${esc(c.src)}</span>
    </div>
    <div class="why">${esc(c.why)}</div>
    <div class="row2">
      <select class="status" data-id="${c.id}" aria-label="Status for ${esc(c.acr)}">${STATUSES.map(s=>`<option ${s===c.status?"selected":""}>${s}</option>`).join("")}</select>
      <button class="btn draft" data-id="${c.id}">✍ Draft abstract</button>
      <button class="btn subm" data-id="${c.id}">${c.sub==="portal"?"Submit via portal ▸":"Submission route ▸"}</button>
      <button class="btn del" data-id="${c.id}">Remove</button>
    </div>
    <textarea data-id="${c.id}" placeholder="Notes — track, angle, co-authors, costs…">${esc(c.notes)}</textarea>
  </div>`;
}

function tailorPrompt(c,w){
  const j=c.kind==="journal", ws=wsGet(w);
  return `You are my Research Conference CoPilot (WRITER role). Tailor the master abstract below for a submission to ${c.name} (${c.acr})${j?"":" \u2014 "+c.city+", event "+fmt(c.event)+", deadline "+fmt(c.dl)}.\n\nRESEARCHER: ${profText()}\n\nVENUE: ${c.url||c.subUrl||"(look up the official site)"} \u2014 first fetch the venue's current CFP/author guidelines and follow its theme, track names, word limit, and required structure exactly. Flag the exact submission route (portal URL or email address) you find.\n\nMASTER ABSTRACT (workstream ${ws.label}):\nTitle: ${ws.title}\nAuthors: ${ws.authors}\n${ws.abs}\n\nRULES: keep every claim faithful to the master \u2014 never invent findings, data, or results; keep it a ${j?"journal-ready":"conference"} abstract; return the tailored abstract, 5\u20138 keywords, the recommended track, and a submission checklist.`;
}
function emailBody(c,w,draft){
  const ws=wsGet(w);
  return `Dear ${c.acr} Organising Committee,\n\nPlease find below our abstract for consideration${c.kind==="journal"?"":" for "+c.name+(c.event?" ("+fmt(c.event)+")":"")}.\n\nTitle: ${ws.title}\nAuthors: ${ws.authors}\nCorresponding author: ${prof.corr}\n\nAbstract:\n${draft}\n\nPlease let us know if any additional information or format is required.\n\nWith kind regards,\n${prof.name}`;
}
async function copyText(t,btn,label){ try{ await navigator.clipboard.writeText(t); const o=btn.textContent; btn.textContent="Copied \u2713"; setTimeout(()=>btn.textContent=label||o,1500);}catch(e){ alert("Copy failed \u2014 select and copy manually."); } }
function openDraft(id,focusSubmit){
  const c=data.find(x=>x.id===id); if(!c) return;
  const wsOpts=computeFits(c); if(!wsOpts.length&&prof.workstreams.length) wsOpts.push(prof.workstreams[0].w);
  let w=c.draftWs&&wsOpts.includes(c.draftWs)?c.draftWs:wsOpts[0];
  const d=document.createElement("dialog"); d.style.maxWidth="640px";
  const route=c.sub==="portal"
    ?`<div class="note blue" style="margin:10px 0"><b>Route decided: online portal.</b> ${esc(c.subNote||"")} ${c.subUrl?`<div style="margin-top:8px"><a class="btn" style="text-decoration:none;display:inline-block" href="${esc(c.subUrl)}" target="_blank" rel="noopener">Open submission portal \u2197</a></div>`:""}<div style="margin-top:6px;font-size:12.5px">Email below is a cover/query template only \u2014 this venue does not take submissions by email.</div></div>`
    :`<div class="note" style="margin:10px 0"><b>Submission route not verified.</b> Check the official CFP for the portal or the announced submission address \u2014 fill "To" only from the official page, never from a guess.</div>`;
  d.innerHTML=`<h2 style="margin:0 0 2px">${esc(c.acr)} \u2014 draft &amp; submit</h2>
    <p style="margin:0 0 10px;color:var(--muted);font-size:13px">${esc(c.name)}</p>
    <label style="font-size:12.5px;font-weight:600">Paper (workstream)</label>
    <select id="dWs" style="font:inherit;margin:4px 0 8px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink)">${wsOpts.map(x=>`<option value="${x}" ${x===w?"selected":""}>${esc(wsGet(x).label)} \u2014 ${esc(wsGet(x).title.slice(0,60))}\u2026</option>`).join("")}</select>
    <textarea id="dAbs" style="width:100%;min-height:180px;font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--ground);color:var(--ink)"></textarea>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
      <button type="button" class="btn" id="dCopy">Copy abstract</button>
      <button type="button" class="btn" id="dDl">Download .md</button>
      <button type="button" class="btn primary" id="dPrompt">Copy tailoring prompt for CoPilot</button>
    </div>
    <div id="dRoute">${route}</div>
    <label style="font-size:12.5px;font-weight:600">To (from the official CFP only)</label>
    <input id="dTo" type="email" placeholder="e.g. submissions@\u2026 \u2014 verify before sending" style="width:100%;font:inherit;margin:4px 0 8px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink)">
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn" id="dEmail">Copy email body</button>
      <button type="button" class="btn" id="dMailto">Open in mail app</button>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="btn" id="dClose">Close</button>
    </div>`;
  document.body.appendChild(d); d.showModal();
  const ta=d.querySelector("#dAbs");
  const setDraft=()=>{ ta.value=(c.drafts&&c.drafts[w])||wsGet(w).title+"\n\n"+wsGet(w).abs; };
  setDraft();
  ta.addEventListener("input",()=>{ c.drafts=c.drafts||{}; c.drafts[w]=ta.value; c.draftWs=w; save(); });
  d.querySelector("#dWs").addEventListener("change",e=>{ w=+e.target.value; c.draftWs=w; setDraft(); save(); });
  d.querySelector("#dCopy").addEventListener("click",e=>copyText(ta.value,e.target,"Copy abstract"));
  d.querySelector("#dDl").addEventListener("click",()=>dl(c.acr.replace(/[^\w-]+/g,"-")+"-abstract.md",ta.value,"text/markdown"));
  d.querySelector("#dPrompt").addEventListener("click",e=>copyText(tailorPrompt(c,w),e.target,"Copy tailoring prompt for CoPilot"));
  d.querySelector("#dEmail").addEventListener("click",e=>copyText(emailBody(c,w,ta.value),e.target,"Copy email body"));
  d.querySelector("#dMailto").addEventListener("click",()=>{
    const to=d.querySelector("#dTo").value.trim();
    if(!to){ alert("Fill the To address from the official CFP first \u2014 never guess a submission address."); return; }
    location.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent("Abstract submission \u2014 "+c.acr+": "+wsGet(w).title)+"&body="+encodeURIComponent(emailBody(c,w,ta.value).slice(0,1800));
  });
  d.querySelector("#dClose").addEventListener("click",()=>d.close());
  d.addEventListener("close",()=>d.remove());
  if(focusSubmit) d.querySelector("#dRoute").scrollIntoView({block:"center"});
}
// tabs
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.tab==="pipe"&&tileFilter){ tileFilter=null; renderPipe(); }
  switchTab(b.dataset.tab);
}));
// find-venues buttons on profile workstreams + match page back button
document.getElementById("backToProf").addEventListener("click",()=>switchTab("prof"));
// keyboard activation for clickable deadline rows
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.classList?.contains("dl-row")){ e.preventDefault(); drillToConf(e.target.dataset.id); }
});
// filters
const fs=document.getElementById("fStatus");
STATUSES.forEach(s=>{const o=document.createElement("option");o.textContent=s;fs.appendChild(o)});
["q","fTier","fStatus"].forEach(id=>document.getElementById(id).addEventListener("input",renderPipe));
// toolbar
document.getElementById("exportBtn").addEventListener("click",()=>dl("pipeline.json",JSON.stringify(data,null,2),"application/json"));
document.getElementById("csvBtn").addEventListener("click",()=>{
  const h=["acronym","name","city","event","deadline","approx","tier","status","url","notes"];
  const rows=data.map(c=>[c.acr,c.name,c.city,c.event,c.dl,c.approx,c.tier,c.status,c.url,(c.notes||"").replace(/\n/g," ")]
    .map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","));
  dl("pipeline.csv",[h.join(","),...rows].join("\n"),"text/csv");
});
document.getElementById("importBtn").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    let imported;
    try{ imported=JSON.parse(r.result); }catch(err){ alert("That file isn't valid JSON."); return; }
    const validEntry=c=>c&&typeof c.id==="string"&&typeof c.acr==="string";
    if(imported&&imported.type==="copilot-scout-digest"&&Array.isArray(imported.venues)){
      // scout digest: MERGE new venues, update changed deadlines, never touch user fields
      if(!imported.venues.every(validEntry)){ alert("Digest venues are malformed — check the scout output."); return; }
      const byId=new Map(data.map(c=>[c.id,c]));
      const fresh=[],changed=[];
      imported.venues.forEach(v=>{
        const cur=byId.get(v.id);
        if(!cur) fresh.push(v);
        else if(v.dl&&v.dl!==cur.dl) changed.push({cur,v});
      });
      if(!fresh.length&&!changed.length){ alert("Nothing new — every digest venue is already tracked with the same deadline."); return; }
      if(confirm(`Scout digest ${imported.date||""}: add ${fresh.length} new venue(s)`+(changed.length?`, update ${changed.length} deadline(s)`:"")+`?`)){
        fresh.forEach(v=>data.push({approx:true,sub:"verify",...v,status:"watching",notes:""}));
        changed.forEach(({cur,v})=>{ cur.notes=(cur.notes?cur.notes+"\n":"")+`Deadline changed ${cur.dl||"?"} → ${v.dl} (scout ${imported.date||""})`; cur.dl=v.dl; cur.approx=v.approx!==false; });
        save();       }
      return;
    }
    if(!Array.isArray(imported)||!imported.length||!imported.every(validEntry)){
      alert("That doesn't look like a CoPilot export or scout digest — expected a pipeline array or a copilot-scout-digest object."); return;
    }
    if(confirm(`Replace your current pipeline (${data.length} entries) with the imported file (${imported.length} entries)? This overwrites current statuses, notes, and drafts here.`)){
      data=imported; save(); tileFilter=null; renderDash(); renderPipe();
    }
  };
  r.readAsText(f); e.target.value="";
});
document.getElementById("icsBtn").addEventListener("click",()=>{
  const icsEsc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  const stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
  const evs=data.filter(c=>c.dl&&!["missed","skipped"].includes(c.status)).map(c=>{
    const d=c.dl.replace(/-/g,""); const nd=new Date(c.dl+"T00:00:00"); nd.setDate(nd.getDate()+1);
    const d2=nd.toISOString().slice(0,10).replace(/-/g,"");
    return ["BEGIN:VEVENT","UID:"+c.id+"@conference-copilot","DTSTAMP:"+stamp,
      "DTSTART;VALUE=DATE:"+d,"DTEND;VALUE=DATE:"+d2,
      "SUMMARY:"+icsEsc("⏰ "+c.acr+" submission deadline"+(c.approx?" (verify)":"")),
      "DESCRIPTION:"+icsEsc(c.name+(c.url?"\n"+c.url:"")+"\nStatus: "+c.status+(c.notes?"\n"+c.notes:"")),
      ...["-P21D","-P7D","-P3D"].map(t=>["BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsEsc(c.acr+" deadline approaching"),"TRIGGER:"+t,"END:VALARM"].join("\r\n")),
      "END:VEVENT"].join("\r\n");
  });
  if(!evs.length){ alert("No dated deadlines to export."); return; }
  dl("copilot-deadlines.ics",["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Conference CoPilot//EN",...evs,"END:VCALENDAR"].join("\r\n"),"text/calendar");
});
document.getElementById("resetBtn").addEventListener("click",()=>{
  if(confirm("Replace your edits with the original researched list?")){ data=structuredClone(SEED); save(); renderDash(); renderPipe(); }
});
function dl(name,content,type){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
// add dialog
document.getElementById("addBtn").addEventListener("click",()=>{
  const d=document.createElement("dialog");
  d.innerHTML=`<form method="dialog">
    <h2 style="margin:0 0 4px">Add conference</h2>
    <label>Acronym</label><input name="acr" required>
    <label>Full name</label><input name="name">
    <label>City, country</label><input name="city">
    <label>Event date</label><input name="event" type="date">
    <label>Submission deadline</label><input name="dl" type="date">
    <label>Tier</label><select name="tier"><option value="1">1 · SDT core</option><option value="2" selected>2 · Education/EdTech</option><option value="3">3 · EDAS/other</option></select>
    <label>URL</label><input name="url" type="url">
    <label>Why it fits</label><input name="why">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn" value="cancel" formnovalidate>Cancel</button>
      <button class="btn primary" value="ok">Add</button>
    </div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener("close",()=>{
    if(d.returnValue==="ok"){
      const f=new FormData(d.querySelector("form"));
      data.push({id:"u"+Date.now(),acr:f.get("acr"),name:f.get("name")||"",city:f.get("city")||"",
        event:f.get("event")||null,dl:f.get("dl")||null,approx:false,tier:+f.get("tier"),src:"added by you",
        url:f.get("url")||"",why:f.get("why")||"",status:"watching",notes:""});
      save(); renderDash(); renderPipe();
    }
    d.remove();
  });
});
// copy buttons
document.querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",async()=>{
  const t=document.getElementById(b.dataset.copy).innerText;
  try{ await navigator.clipboard.writeText(t); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy",1600) }
  catch(e){ b.textContent="Select & copy manually" }
}));
renderDash(); renderPipe();

// ---- optional cloud sync (Supabase) — active only when config.js sets window.COPILOT_SUPABASE ----
function pushCloud(now){
  if(!sb||!sbUser) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(async()=>{
    try{
      const payload={user_id:sbUser.id,data:data,updated_at:new Date().toISOString()};
      if(window.__profCol!==false) payload.profile=prof;
      let {error}=await sb.from("user_pipelines").upsert(payload);
      if(error&&/profile/i.test(error.message||"")&&window.__profCol!==false){
        window.__profCol=false; console.warn("profile column missing - run migration 002");
        ({error}=await sb.from("user_pipelines").upsert({user_id:sbUser.id,data:data,updated_at:new Date().toISOString()}));
      }
      if(error) throw error;
    }catch(e){ console.warn("CoPilot cloud push failed:",e.message||e); }
  },now?0:1500);
}
async function pullCloud(){
  try{
    let {data:row,error}=await sb.from("user_pipelines").select("data,profile").eq("user_id",sbUser.id).maybeSingle();
    if(error&&/profile/i.test(error.message||"")){
      window.__profCol=false; console.warn("profile column missing - run migration 002");
      ({data:row,error}=await sb.from("user_pipelines").select("data").eq("user_id",sbUser.id).maybeSingle());
    }
    if(error) throw error;
    if(row&&row.profile&&Array.isArray(row.profile.workstreams)){ prof=row.profile; try{localStorage.setItem(PKEY,JSON.stringify(prof))}catch(e){} renderProfile(); }
    if(row&&Array.isArray(row.data)&&row.data.length){
      data=row.data; try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}
      tileFilter=null; renderDash(); renderPipe();
    }else if(data.length&&confirm("No cloud pipeline on this account yet — upload this device's data ("+data.length+" entries)?")){
      pushCloud(true);
    }
  }catch(e){ console.warn("CoPilot cloud pull failed:",e.message||e); }
}
(async function initCloud(){
  const cfg=window.COPILOT_SUPABASE, el=document.getElementById("acct");
  if(!cfg||!cfg.url||!cfg.anonKey||!el) return; // localStorage-only mode
  let createClient;
  try{ ({createClient}=await import("https://esm.sh/@supabase/supabase-js@2")); }
  catch(e){ console.warn("CoPilot cloud: supabase-js failed to load:",e.message||e); return; }
  sb=createClient(cfg.url,cfg.anonKey);
  el.hidden=false;
  renderProfile();
  const renderAcct=()=>{
    el.innerHTML=sbUser
      ? `<span class="pill good">☁ synced · ${esc(sbUser.email)}</span><button class="btn" id="signOut">Sign out</button>`
      : `<button class="btn" id="signIn">☁ Sign in to sync across devices</button>`;
    const si=document.getElementById("signIn"),so=document.getElementById("signOut");
    if(si) si.addEventListener("click",async()=>{
      const email=prompt("Email for the magic sign-in link:"); if(!email) return;
      const {error}=await sb.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+location.pathname}});
      alert(error?("Sign-in failed: "+error.message):"Check your inbox and open the sign-in link on this device.");
    });
    if(so) so.addEventListener("click",()=>sb.auth.signOut());
  };
  renderAcct();
  sb.auth.onAuthStateChange((_evt,session)=>{
    sbUser=session&&session.user||null;
    renderAcct();
    if(sbUser) pullCloud();
  });
})();

// ---- scraper review queue: data/cfp-feed.json → approve/dismiss (#12) ----
const DISMISS_KEY="cqe-cfp-dismissed-v1";
let dismissed=new Set(); try{dismissed=new Set(JSON.parse(localStorage.getItem(DISMISS_KEY)||"[]"))}catch(e){}
function saveDismissed(){ try{localStorage.setItem(DISMISS_KEY,JSON.stringify([...dismissed]))}catch(e){} }
(async function initQueue(){
  let feed;
  try{ const r=await fetch("data/cfp-feed.json",{cache:"no-store"}); if(!r.ok) return; feed=await r.json(); }
  catch(e){ return; } // single-file/offline builds have no feed — queue simply absent
  if(!feed||!Array.isArray(feed.venues)) return;
  renderQueue(feed);
})();
function renderQueue(feed){
  const H=document.getElementById("rqH"),L=document.getElementById("rqList");
  if(!H||!L) return;
  const byId=new Map(data.map(c=>[c.id,c]));
  const news=feed.venues.filter(v=>!byId.has(v.id)&&!dismissed.has(v.id)&&days(v.dl)!==null&&days(v.dl)>=0);
  const changes=feed.venues.filter(v=>byId.has(v.id)&&v.dl&&byId.get(v.id).dl!==v.dl&&!dismissed.has("chg:"+v.id+":"+v.dl));
  if(!news.length&&!changes.length){ H.hidden=true; L.innerHTML=""; return; }
  H.hidden=false;
  H.textContent=`Scraper review queue — ${news.length} new CFP${news.length===1?"":"s"}${changes.length?`, ${changes.length} deadline change${changes.length===1?"":"s"}`:""} · feed ${feed.date}`;
  L.innerHTML=changes.map(v=>{const cur=byId.get(v.id);
    return `<div class="dl-row"><span class="date mono">${fmt(v.dl)}</span>
      <span class="who"><b>${esc(cur.acr)}</b> <span class="m">deadline ${fmt(cur.dl)} → ${fmt(v.dl)} (scraped — verify)</span></span>
      <button class="btn" data-qa="chg" data-id="${esc(v.id)}" data-dl="${esc(v.dl)}">Apply</button>
      <button class="btn" data-qa="dchg" data-id="${esc(v.id)}" data-dl="${esc(v.dl)}">Dismiss</button></div>`;
  }).join("")+news.slice(0,15).map(v=>`<div class="dl-row">
      <span class="date mono">${fmt(v.dl)}</span>
      <span class="who"><b>${esc(v.acr)}</b> <span class="m">· ${esc((v.name||"").slice(0,70))} · ${esc(v.city)}</span> <span class="verify">unvetted</span></span>
      <button class="btn" data-qa="add" data-id="${esc(v.id)}">Add</button>
      <button class="btn" data-qa="dis" data-id="${esc(v.id)}">Dismiss</button></div>`).join("");
  L.querySelectorAll("[data-qa]").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.id,act=b.dataset.qa,v=feed.venues.find(x=>x.id===id);
    if(act==="add"&&v){ data.push({approx:true,sub:"verify",...v,status:"watching",notes:""}); save(); renderDash(); renderPipe(); }
    if(act==="dis"){ dismissed.add(id); saveDismissed(); }
    if(act==="chg"&&v){ const cur=data.find(x=>x.id===id);
      if(cur){ cur.notes=(cur.notes?cur.notes+"\n":"")+`Deadline ${cur.dl||"?"} → ${v.dl} (scraper ${feed.date})`; cur.dl=v.dl; cur.approx=true; save(); renderDash(); renderPipe(); } }
    if(act==="dchg"){ dismissed.add("chg:"+id+":"+b.dataset.dl); saveDismissed(); }
    renderQueue(feed);
  }));
}

// ---- dynamic researcher profile tab (#14) ----
function renderProfile(){
  const B=document.getElementById("profBody"); if(!B) return;
  B.innerHTML=`<div class="prose">
    <h2>${esc(prof.name)}</h2>
    <p>${esc(prof.headline)}<br>${esc(prof.guidance)}</p>
    <h2>Thesis</h2>
    <p><b>${esc(prof.thesis)}.</b> ${esc(prof.thesisDesc)}</p>
    <p>${prof.chain.map(x=>`<span class="pill acc">${esc(x)}</span>`).join(" \u2192 ")}</p>
    <div class="editbtns"><button class="btn" id="editProf">Edit profile</button><button class="btn" id="addWs">Add workstream</button>${sb?`<button class="btn" id="shareBtn">Share read-only link</button>`:""}</div>
  </div>
  <h2>Workstreams \u2192 one thesis</h2>`+
  prof.workstreams.map(ws=>`<div class="conf"><div class="top"><span class="acr">${esc(ws.label)}</span><span class="name">${esc(ws.short)} </span><span class="pill ${esc(ws.tagCls||"")}">${esc(ws.tag||"")}</span></div>
    <div class="why">${esc(ws.desc||"")}</div>
    <div class="row2"><button type="button" class="btn matchbtn" data-ws="${ws.w}">Find venues for this paper \u2192</button>
    <button type="button" class="btn wsedit editbtns" style="margin:0" data-ws="${ws.w}">Edit</button></div></div>`).join("")+
  `<div class="prose"><h2>Execution roadmap</h2><p>${esc(prof.roadmap)}</p>
   <h2>Conference track record</h2><p>${esc(prof.record)}</p></div>`;
  B.querySelectorAll(".matchbtn").forEach(b=>b.addEventListener("click",()=>renderMatch(+b.dataset.ws)));
  B.querySelectorAll(".wsedit").forEach(b=>b.addEventListener("click",()=>editWsDialog(+b.dataset.ws)));
  const ep=document.getElementById("editProf"); if(ep) ep.addEventListener("click",editProfileDialog);
  const aw=document.getElementById("addWs"); if(aw) aw.addEventListener("click",()=>editWsDialog(null));
  const sh=document.getElementById("shareBtn"); if(sh) sh.addEventListener("click",shareDialog);
}
function fld(label,id,val,rows){ return `<label style="font-size:12.5px;font-weight:600;display:block;margin:8px 0 3px">${label}</label>`+
  (rows?`<textarea id="${id}" rows="${rows}">${esc(val||"")}</textarea>`:`<input id="${id}" style="width:100%;font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink)" value="${esc(val||"")}">`);
}
function editProfileDialog(){
  const d=document.createElement("dialog"); d.style.maxWidth="640px";
  d.innerHTML=`<h2 style="margin:0 0 8px">Edit researcher profile</h2>
    ${fld("Name","pName",prof.name)}${fld("Headline (role, institution, contact)","pHead",prof.headline,2)}
    ${fld("Guidance (supervisors, committee)","pGuide",prof.guidance,2)}${fld("Thesis title","pThesis",prof.thesis)}
    ${fld("Thesis description","pDesc",prof.thesisDesc,3)}${fld("Causal chain (\u2192-separated)","pChain",prof.chain.join(" \u2192 "))}
    ${fld("Roadmap","pRoad",prof.roadmap,3)}${fld("Track record","pRec",prof.record,3)}
    ${fld("Correspondence line (for submission emails)","pCorr",prof.corr)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" id="pCancel">Cancel</button><button class="btn primary" id="pSave">Save</button></div>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector("#pCancel").addEventListener("click",()=>d.close());
  d.querySelector("#pSave").addEventListener("click",()=>{
    const v=id=>d.querySelector("#"+id).value.trim();
    Object.assign(prof,{name:v("pName"),headline:v("pHead"),guidance:v("pGuide"),thesis:v("pThesis"),
      thesisDesc:v("pDesc"),chain:v("pChain").split("\u2192").map(s=>s.trim()).filter(Boolean),
      roadmap:v("pRoad"),record:v("pRec"),corr:v("pCorr")});
    saveProf(); renderProfile(); d.close();
  });
  d.addEventListener("close",()=>d.remove());
}
function editWsDialog(w){
  const isNew=w===null;
  const ws=isNew?{w:Math.max(0,...prof.workstreams.map(x=>x.w))+1,label:"",short:"",tag:"planned",tagCls:"",desc:"",matchNote:"",authors:prof.name+" et al.",title:"",abs:"",keywords:[]}:wsGet(w);
  const d=document.createElement("dialog"); d.style.maxWidth="640px";
  d.innerHTML=`<h2 style="margin:0 0 8px">${isNew?"Add":"Edit"} workstream</h2>
    ${fld("Label (e.g. W5 \u00b7 New direction)","wLabel",ws.label)}${fld("One-line summary","wShort",ws.short)}
    ${fld("Status tag (e.g. drafting)","wTag",ws.tag)}${fld("Description","wDesc",ws.desc,3)}
    ${fld("Match-page note","wNote",ws.matchNote,2)}${fld("Paper title","wTitle",ws.title,2)}
    ${fld("Authors","wAuth",ws.authors)}${fld("Master abstract","wAbs",ws.abs,7)}
    ${fld("Matching keywords (comma-separated)","wKw",(ws.keywords||[]).join(", "))}
    <div style="display:flex;gap:8px;margin-top:14px">${isNew?"":`<button class="btn" id="wDel">Delete</button>`}<span style="flex:1"></span><button class="btn" id="wCancel">Cancel</button><button class="btn primary" id="wSave">Save</button></div>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector("#wCancel").addEventListener("click",()=>d.close());
  const del=d.querySelector("#wDel");
  if(del) del.addEventListener("click",()=>{
    if(confirm(`Delete ${ws.label}? Venue fit tags pointing at it stop matching.`)){
      prof.workstreams=prof.workstreams.filter(x=>x.w!==ws.w); saveProf(); renderProfile(); d.close();
    }});
  d.querySelector("#wSave").addEventListener("click",()=>{
    const v=id=>d.querySelector("#"+id).value.trim();
    Object.assign(ws,{label:v("wLabel")||("W"+ws.w),short:v("wShort"),tag:v("wTag"),desc:v("wDesc"),
      matchNote:v("wNote"),title:v("wTitle"),authors:v("wAuth"),abs:v("wAbs"),
      keywords:v("wKw").split(",").map(s=>s.trim()).filter(Boolean)});
    if(isNew) prof.workstreams.push(ws);
    saveProf(); renderProfile(); d.close();
  });
  d.addEventListener("close",()=>d.remove());
}
// ---- read-only share links (#16) ----
async function shareDialog(){
  if(!sb||!sbUser){ alert("Sign in first."); return; }
  const d=document.createElement("dialog"); d.style.maxWidth="560px";
  d.innerHTML=`<h2 style="margin:0 0 8px">Read-only share links</h2>
    <p style="font-size:13px;color:var(--muted)">A link shows your pipeline and profile, view-only. Revoke any time. Requires migration 002 on the backend.</p>
    <div id="shList" style="font-size:13px">Loading\u2026</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="shNew">Create link</button><span style="flex:1"></span><button class="btn" id="shClose">Close</button></div>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector("#shClose").addEventListener("click",()=>d.close());
  d.addEventListener("close",()=>d.remove());
  const refresh=async()=>{
    const L=d.querySelector("#shList");
    try{
      const {data:rows,error}=await sb.from("shares").select("token,revoked,created_at").order("created_at",{ascending:false});
      if(error) throw error;
      L.innerHTML=rows.length?rows.map(r=>{
        const link=location.origin+location.pathname+"#share="+r.token;
        return `<div class="dl-row" style="margin-bottom:6px"><span class="who mono" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis">${r.revoked?"<s>"+link+"</s>":link}</span>
          ${r.revoked?'<span class="pill">revoked</span>':`<button class="btn shCopy" data-l="${link}">Copy</button><button class="btn shRev" data-t="${r.token}">Revoke</button>`}</div>`;
      }).join(""):"<p>No links yet.</p>";
      L.querySelectorAll(".shCopy").forEach(b=>b.addEventListener("click",e=>copyText(e.target.dataset.l,e.target,"Copy")));
      L.querySelectorAll(".shRev").forEach(b=>b.addEventListener("click",async e=>{
        await sb.from("shares").update({revoked:true}).eq("token",e.target.dataset.t); refresh();
      }));
    }catch(e){ L.innerHTML="<p class='verify'>Backend not ready: "+esc(e.message||String(e))+" \u2014 run supabase/migrations/002_profile_shares.sql.</p>"; }
  };
  d.querySelector("#shNew").addEventListener("click",async()=>{
    try{ const {error}=await sb.from("shares").insert({user_id:sbUser.id}); if(error) throw error; refresh(); }
    catch(e){ alert("Could not create link: "+(e.message||e)); }
  });
  refresh();
}
(async function initShareView(){
  const m=/[#&]share=([0-9a-f-]{36})/.exec(location.hash);
  if(!m) return;
  const cfg=window.COPILOT_SUPABASE; if(!cfg||!cfg.url) return;
  try{
    const r=await fetch(cfg.url+"/rest/v1/rpc/get_shared_pipeline",{method:"POST",
      headers:{apikey:cfg.anonKey,Authorization:"Bearer "+cfg.anonKey,"Content-Type":"application/json"},
      body:JSON.stringify({share_token:m[1]})});
    const payload=await r.json();
    if(!r.ok||!payload||!Array.isArray(payload.data)) throw new Error(payload&&payload.message||"link invalid or revoked");
    RO=true; document.body.classList.add("ro");
    data=payload.data;
    if(payload.profile&&Array.isArray(payload.profile.workstreams)) prof=payload.profile;
    const b=document.createElement("div"); b.className="robanner";
    b.textContent="Read-only view shared from "+prof.name+"'s Conference CoPilot.";
    document.querySelector("header.page").prepend(b);
    renderDash(); renderPipe(); renderProfile();
  }catch(e){
    const b=document.createElement("div"); b.className="robanner";
    b.textContent="This share link is invalid, revoked, or the backend migration hasn't run yet ("+(e.message||e)+").";
    document.querySelector("header.page").prepend(b);
  }
})();

// boot — after all declarations above
renderDash(); renderPipe(); renderProfile();
