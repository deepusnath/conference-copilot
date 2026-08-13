// App logic. Content/data lives in seed-data.js.
const KEY="cqe-conf-tracker-v2";
let sb=null,sbUser=null,pushTimer=null; // cloud state — declared early: save() may run during initial load
// ---- researcher profile state (#14) + keyword matching engine (#15) ----
const PKEY="cqe-profile-v1";
let prof=null;
let FIRSTRUN=false, EXAMPLE=false;
try{ prof=JSON.parse(localStorage.getItem(PKEY))||null }catch(e){}
if(!prof||!Array.isArray(prof.workstreams)){ prof=structuredClone(EMPTY_PROFILE); FIRSTRUN=true; }
else{
  prof={...structuredClone(EMPTY_PROFILE),...prof}; // normalize: older/minimal profiles get missing fields
  if(!("curated" in prof)&&prof.workstreams.some(x=>(x.label||"").includes("Map the field"))){
    prof.curated=true; try{localStorage.setItem(PKEY,JSON.stringify(prof))}catch(e){}
  }
}
let RO=false; // read-only share view
function saveProf(){ if(RO||EXAMPLE) return; try{localStorage.setItem(PKEY,JSON.stringify(prof))}catch(e){} if(typeof pushCloud==="function") pushCloud(); }
function wsGet(w){ return prof.workstreams.find(x=>x.w===w)||prof.workstreams[0]; }
function computeFits(c){
  const out=new Set([
    ...(prof.curated?(c.fits||[]):[]),
    ...(c.myFits||[]) // user-adopted assignments always count
  ].filter(w=>prof.workstreams.some(x=>x.w===w)));
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
if(!data){ if(FIRSTRUN){ data=[]; } else { data=structuredClone(SEED); save(); } }
else{ const known=new Map(data.map(c=>[c.id,c])); let changed=false;
  SEED.forEach(s=>{
    const cur=known.get(s.id);
    if(!cur){ if(prof.curated){ data.push(structuredClone(s)); changed=true; } } // catalog additions flow to the founder only; others use the review queue
    else{ // sync curated metadata into stored copies without touching user fields
      if(prof.curated&&JSON.stringify(cur.fits||null)!==JSON.stringify(s.fits||null)){ cur.fits=s.fits; changed=true; }
      if((cur.kind||null)!==(s.kind||null)){ cur.kind=s.kind; changed=true; }
      if(cur.tier!==s.tier){ cur.tier=s.tier; changed=true; }
    }
  });
  if(changed) save(); }

function save(){ if(RO||EXAMPLE) return; try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){} if(typeof pushCloud==="function") pushCloud(); }
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
  document.getElementById("matchTitle").textContent="Venue matches \u2014 "+ws.label+((ws.short&&!ws.label.includes(ws.short.slice(0,24)))?": "+ws.short:"");
  document.getElementById("matchNote").textContent=ws.matchNote||"";
  const list=data.filter(c=>computeFits(c).includes(w));
  if(!list.length){
    document.getElementById("matchList").innerHTML=`<div class="note">
      <b>No catalog venues match this paper yet.</b> The built-in catalog leans toward education, motivation, and management research \u2014 your topic may live outside it. Three ways forward:</div>
      <div class="editbtns" style="margin-top:12px">
        <button class="btn primary" id="huntGo">\ud83d\udd0d Hunt venues now</button>
        <button class="btn" id="huntBtn">Copy hunt prompt instead</button>
        <button class="btn" id="catBtn">Browse the full catalog (${SEED.length})</button>
        <button class="btn" id="kwBtn">Edit this paper\u2019s keywords</button>
      </div>
      <div id="huntUI"></div>
      <div id="catList"></div>`;
    document.getElementById("huntGo").addEventListener("click",()=>startHunt(w,"basic"));
    document.getElementById("huntBtn").addEventListener("click",e=>copyText(huntPrompt(ws),e.target,"Copy hunt prompt instead"));
    document.getElementById("kwBtn").addEventListener("click",()=>editWsDialog(w));
    document.getElementById("catBtn").addEventListener("click",()=>renderCatalog(w));
    switchTab("match"); window.scrollTo({top:0});
    return;
  }
  document.getElementById("matchList").innerHTML=groupedCards(list,"")+`<div class="editbtns" style="margin-top:16px"><button class="btn" id="huntGo2">\ud83d\udd0d Hunt more venues for this paper</button></div><div id="huntUI"></div>`;
  document.getElementById("huntGo2").addEventListener("click",()=>startHunt(w,"basic"));
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
  if(!data.length){
    document.getElementById("pipeList").innerHTML=`<p style="color:var(--muted)">Your pipeline is empty. Finish the 5-question setup (reload the page), import a scout digest via Import JSON, or add venues manually \u2014 the scrapers refresh the review queue Tuesdays and Fridays.</p>`;
    return;
  }
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
function qBadge(c){
  const q=c.q||{verdict:"unscreened",evidence:"Not yet screened — run the vet checklist before submitting"};
  const cls={submit:"good",caution:"warn",skip:"crit"}[q.verdict]||"";
  return `<span class="pill ${cls}" title="${esc(q.evidence||"")}">${esc(q.verdict)}</span>`;
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
      ${qBadge(c)}
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
  if(!prof.workstreams.length){ alert("Add a paper first: Researcher profile \u2192 Add workstream (or restart setup)."); return; }
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
    if(row&&row.profile&&Array.isArray(row.profile.workstreams)){ prof=row.profile; try{localStorage.setItem(PKEY,JSON.stringify(prof))}catch(e){} renderProfile(); FIRSTRUN=false; const wd=document.getElementById("wizDlg"); if(wd&&!wd.dataset.dirty){ wd.close(); wd.remove(); } }
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
    if(si) si.addEventListener("click",signInDialog);
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
  const kick=document.querySelector(".kicker");
  if(kick) kick.textContent=prof.name?(prof.name+(prof.thesis?" \u00b7 "+prof.thesis.slice(0,60):"")):"Set up your research profile to begin";
  B.innerHTML=`<div class="prose">
    <h2>${esc(prof.name)}</h2>
    <p>${esc(prof.headline)}<br>${esc(prof.guidance)}</p>
    <h2>Thesis</h2>
    <p><b>${esc(prof.thesis)}.</b> ${esc(prof.thesisDesc)}</p>
    <p>${(prof.chain||[]).map(x=>`<span class="pill acc">${esc(x)}</span>`).join(" \u2192 ")}</p>
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
if(FIRSTRUN&&!/[#&]share=/.test(location.hash)) openWizard();

// ---- first-run onboarding wizard (P1, #22) ----
function wizInput(id,label,val,ph){ return `<label class="wizl">${label}</label><input id="${id}" class="wizf" value="${esc(val||"")}" placeholder="${esc(ph||"")}">`; }
function openWizard(){
  if(document.getElementById("wizDlg")) return;
  const d=document.createElement("dialog"); d.id="wizDlg"; d.className="wiz";
  document.body.appendChild(d);
  d.addEventListener("input",()=>{ d.dataset.dirty=1; });
  d.addEventListener("close",()=>d.remove());
  const ans={name:"",stage:"PhD candidate",inst:"",country:"",field:"Education",topic:"",kw:new Set(FIELD_KEYWORDS["Education"].slice(0,4)),papers:[{title:"",stage:"idea",kw:""}]};
  const PSTAGES=[["idea","Idea / early"],["design","Design ready"],["data","Data collected"],["results","Results ready"]];
  let step=0;
  const dots=()=>`<div class="wizdots">${[1,2,3].map(i=>`<span class="${i<=step?"on":""}"></span>`).join("")}</div>`;
  function grab(){ // pull current inputs into ans before navigating
    const g=id=>{const el=d.querySelector("#"+id); return el?el.value.trim():null;};
    if(step===1){ ans.name=g("zName")??ans.name; ans.stage=g("zStage")??ans.stage; ans.inst=g("zInst")??ans.inst; ans.country=g("zCountry")??ans.country; }
    if(step===2){ ans.topic=g("zTopic")??ans.topic; }
    if(step===3){ d.querySelectorAll(".wizpaper").forEach((row,i)=>{
      ans.papers[i]={title:row.querySelector(".pt").value.trim(),stage:row.querySelector(".ps").value,kw:row.querySelector(".pk").value.trim()};
    }); }
  }
  function nav(to){ grab(); step=to; render(); }
  function render(){
    if(step===0){ d.innerHTML=`<div class="wizbody">
      <h2>Welcome to Conference CoPilot</h2>
      <p class="sub">Track calls-for-papers, deadlines, and your submission pipeline \u2014 configured for <b>your</b> research in five quick questions.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
        <button class="btn primary" id="zStart">Set up my CoPilot (2 min)</button>
        <button class="btn" id="zExample">Explore the example workspace first</button>
        <button class="btn" id="zSkip" style="border:none;background:none;color:var(--faint)">Skip for now</button>
      </div></div>`;
      d.querySelector("#zStart").onclick=()=>nav(1);
      d.querySelector("#zExample").onclick=()=>{ d.close(); enterExample(); };
      d.querySelector("#zSkip").onclick=()=>d.close();
    }
    if(step===1){ d.innerHTML=`<div class="wizbody">${dots()}<h2>About you</h2>
      ${wizInput("zName","Name",ans.name,"e.g. Priya Raman")}
      <label class="wizl">Career stage</label>
      <select id="zStage" class="wizf">${["PhD candidate","Postdoc","Faculty","Independent researcher"].map(s=>`<option ${s===ans.stage?"selected":""}>${s}</option>`).join("")}</select>
      ${wizInput("zInst","Institution",ans.inst,"e.g. Amrita School of Business")}
      ${wizInput("zCountry","Country",ans.country,"e.g. India")}
      <div class="wiznav"><button class="btn" id="zB">\u2190 Back</button><button class="btn primary" id="zN">Next \u2192</button></div></div>`;
      d.querySelector("#zB").onclick=()=>nav(0); d.querySelector("#zN").onclick=()=>nav(2);
    }
    if(step===2){ d.innerHTML=`<div class="wizbody">${dots()}<h2>Your research</h2>
      <label class="wizl">Field</label>
      <select id="zField" class="wizf">${Object.keys(FIELD_KEYWORDS).map(f=>`<option ${f===ans.field?"selected":""}>${f}</option>`).join("")}</select>
      ${wizInput("zTopic","Your research in one line",ans.topic,"e.g. Self-Determination Theory in gamified learning")}
      <label class="wizl">Matching keywords \u2014 tap to toggle, these find your venues</label>
      <div id="zChips" class="wizchips"></div>
      <div style="display:flex;gap:8px"><input id="zKwAdd" class="wizf" style="flex:1" placeholder="add your own keyword"><button class="btn" id="zKwBtn">Add</button></div>
      <div class="wiznav"><button class="btn" id="zB">\u2190 Back</button><button class="btn primary" id="zN">Next \u2192</button></div></div>`;
      const chips=()=>{ d.querySelector("#zChips").innerHTML=[...new Set([...FIELD_KEYWORDS[ans.field],...ans.kw])].map(k=>`<button type="button" class="chip ${ans.kw.has(k)?"on":""}" data-k="${esc(k)}">${esc(k)}</button>`).join("");
        d.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ const k=b.dataset.k; ans.kw.has(k)?ans.kw.delete(k):ans.kw.add(k); chips(); }); };
      chips();
      d.querySelector("#zField").onchange=e=>{ ans.field=e.target.value; FIELD_KEYWORDS[ans.field].slice(0,4).forEach(k=>ans.kw.add(k)); chips(); };
      d.querySelector("#zKwBtn").onclick=()=>{ const v=d.querySelector("#zKwAdd").value.trim().toLowerCase(); if(v){ ans.kw.add(v); d.querySelector("#zKwAdd").value=""; chips(); } };
      d.querySelector("#zB").onclick=()=>nav(1); d.querySelector("#zN").onclick=()=>nav(3);
    }
    if(step===3){ d.innerHTML=`<div class="wizbody">${dots()}<h2>What are you working on?</h2>
      <p class="sub">Each paper becomes a workstream \u2014 the CoPilot matches venues per paper. One is enough to start.</p>
      <div id="zPapers">${ans.papers.map((p,i)=>`<div class="wizpaper">
        <input class="wizf pt" value="${esc(p.title)}" placeholder="Working title of paper ${i+1}">
        <div style="display:flex;gap:8px"><select class="wizf ps" style="flex:1">${PSTAGES.map(([v,l])=>`<option value="${v}" ${v===p.stage?"selected":""}>${l}</option>`).join("")}</select>
        <input class="wizf pk" style="flex:2" value="${esc(p.kw)}" placeholder="keywords (comma-separated, optional)"></div></div>`).join("")}</div>
      ${ans.papers.length<3?'<button class="btn" id="zMore">+ Add another paper</button>':""}
      <div class="wiznav"><button class="btn" id="zB">\u2190 Back</button><button class="btn primary" id="zN">Create my CoPilot \u2192</button></div></div>`;
      const more=d.querySelector("#zMore"); if(more) more.onclick=()=>{ grab(); ans.papers.push({title:"",stage:"idea",kw:""}); render(); };
      d.querySelector("#zB").onclick=()=>nav(2);
      d.querySelector("#zN").onclick=()=>{ grab(); const added=finishWizard(ans); step=4; render(); d.dataset.added=added; };
    }
    if(step===4){
      const dated=data.filter(c=>c.dl&&days(c.dl)>=0).sort((x,y)=>days(x.dl)-days(y.dl));
      const nearest=dated[0];
      d.innerHTML=`<div class="wizbody"><h2>\ud83c\udf93 Your CoPilot is ready</h2>
      <p class="sub"><b>${data.length}</b> venue${data.length===1?"":"s"} match your papers${nearest?` \u2014 the nearest deadline is <b>${esc(nearest.acr)}</b> on ${fmt(nearest.dl)}`:""}. The scout adds more every Monday; scrapers refresh Tuesdays and Fridays.</p>
      ${(window.COPILOT_SUPABASE&&!sbUser)?'<p class="sub">Tip: click <b>\u2601 Sign in to sync</b> under the tabs to keep this on all your devices.</p>':""}
      <div class="wiznav"><button class="btn" id="zEdit">Refine my profile</button><button class="btn primary" id="zGo">Open my dashboard \u2192</button></div></div>`;
      d.querySelector("#zGo").onclick=()=>{ d.close(); switchTab("dash"); };
      d.querySelector("#zEdit").onclick=()=>{ d.close(); switchTab("prof"); };
    }
  }
  render(); d.showModal();
}
function finishWizard(ans){
  const kw=[...ans.kw];
  prof=structuredClone(EMPTY_PROFILE);
  prof.name=ans.name||"Researcher";
  prof.headline=[ans.stage,ans.inst,ans.country].filter(Boolean).join(", ");
  prof.thesis=ans.topic;
  prof.corr=prof.name+(ans.inst?", "+ans.inst:"");
  prof.meta={field:ans.field,stage:ans.stage,country:ans.country,keywords:kw};
  const stageTag={idea:["early stage","warn"],design:["design ready","warn"],data:["data collected","warn"],results:["results ready","good"]};
  prof.workstreams=ans.papers.filter(p=>p.title||p.kw).map((p,i)=>{
    const pk=p.kw.split(",").map(s=>s.trim()).filter(Boolean);
    return {w:i+1,label:("W"+(i+1)+" \u00b7 "+(p.title||"Paper "+(i+1))).slice(0,48),short:p.title,
      tag:stageTag[p.stage][0],tagCls:stageTag[p.stage][1],desc:"",matchNote:"",
      authors:prof.name+" et al.",title:p.title,abs:"",keywords:pk.length?pk:kw};
  });
  if(!prof.workstreams.length) prof.workstreams=[{w:1,label:"W1 \u00b7 My research",short:ans.topic,tag:"early stage",tagCls:"warn",desc:"",matchNote:"",authors:prof.name+" et al.",title:ans.topic,abs:"",keywords:kw}];
  FIRSTRUN=false;
  saveProf();
  const have=new Set(data.map(c=>c.id));
  let added=0;
  SEED.forEach(v=>{ if(have.has(v.id)) return;
    const c=structuredClone(v); delete c.fits; // curated fits are the founder's — match on keywords only
    if(computeFits(c).length){ c.status="watching"; c.notes=""; data.push(c); added++; } });
  save(); renderDash(); renderPipe(); renderProfile();
  return added;
}
function enterExample(){
  EXAMPLE=true;
  prof=structuredClone(EXAMPLE_PROFILE);
  data=structuredClone(SEED);
  const b=document.createElement("div"); b.className="robanner"; b.id="exBanner";
  b.innerHTML=`Example workspace \u2014 the founder\u2019s real pipeline. Changes here are not saved. <button class="btn" id="exExit" style="margin-left:10px">Start my CoPilot \u2192</button>`;
  document.querySelector("header.page").prepend(b);
  b.querySelector("#exExit").onclick=()=>{ EXAMPLE=false; prof=structuredClone(EMPTY_PROFILE); data=[]; b.remove(); renderDash(); renderPipe(); renderProfile(); openWizard(); };
  renderDash(); renderPipe(); renderProfile();
}

// ---- venue-hunt prompt (agent finds venues outside the catalog) ----
function huntPrompt(ws){
  return `You are my Research Conference CoPilot (SCOUT role). Find 8\u201312 credible venues (conferences AND journals) for this paper, using web search and official sites only.\n\nPAPER: ${ws.title||ws.short||ws.label}\nStage: ${ws.tag||"early"}\nKeywords: ${(ws.keywords||[]).join(", ")}\nRESEARCHER: ${profText()||prof.name}\nBase location: ${(prof.meta&&prof.meta.country)||"(see profile)"}\n\nRULES: verify every deadline on the official page (note the timezone); score each venue 1\u20135 on topical fit, reputation/indexing (verified at the publisher, not the CFP), deadline feasibility (\u22653 weeks out), cost from my location, and career value; SCREEN OUT predatory venues (guaranteed acceptance, pay-to-publish tone, unverifiable indexing, multi-city same-week series) but list them in a one-line "screened out" note.\n\nOUTPUT BOTH:\n1. A ranked table: venue | where/when | deadline | scores | link.\n2. A fenced \u0060\u0060\u0060json block in this exact copilot-scout-digest format so I can import it directly:\n{"type":"copilot-scout-digest","version":1,"date":"YYYY-MM-DD","venues":[{"id":"kebab-slug-year","acr":"ACRO 2027","name":"full name","city":"City, Country","event":"YYYY-MM-DD or null","dl":"YYYY-MM-DD or null","approx":true,"tier":2,"url":"https://official","why":"one-line fit rationale","fits":[${ws.w}],"sub":"verify","subUrl":null,"src":"venue hunt YYYY-MM-DD"}]}\nUse null for anything unverified; never invent URLs, emails, or dates.`;
}
// ---- catalog browser (lite, ahead of P2 #23) ----
function renderCatalog(w){
  const L=document.getElementById("catList"); if(!L) return;
  const have=new Set(data.map(c=>c.id));
  const rest=SEED.filter(v=>!have.has(v.id));
  L.innerHTML=`<div class="group-h" style="margin-top:18px">Full catalog \u2014 curated venues not in your pipeline (${rest.length})</div>`+
    (rest.length?rest.map(v=>`<div class="dl-row">
      <span class="date mono">${fmt(v.dl)}</span>
      <span class="who"><b>${esc(v.acr)}</b> <span class="m">\u00b7 ${esc((v.name||"").slice(0,60))} \u00b7 ${esc(v.city)}</span></span>
      ${qBadge(v)}
      <button class="btn catadd" data-id="${esc(v.id)}">Add</button>
    </div>`).join(""):"<p class='sub'>Everything in the catalog is already in your pipeline.</p>");
  L.querySelectorAll(".catadd").forEach(b=>b.addEventListener("click",()=>{
    const v=SEED.find(x=>x.id===b.dataset.id); if(!v) return;
    const c=structuredClone(v); if(!prof.curated) delete c.fits;
    c.status="watching"; c.notes="";
    if(w){ c.myFits=[w]; } // adding from a paper's match page adopts it for that paper
    data.push(c); save(); renderDash(); renderPipe(); renderCatalog(w);
  }));
}

// ---- integrated venue hunting (basic + extended) ----
const HUNT_PHASES=[["Searching the web for venues\u2026",12],["Screening out predatory venues\u2026",18],["Checking deadlines and fit\u2026",25],["Formatting results\u2026",40]];
let huntBusy=false,lastHunt=null;
function huntHost(){ return document.getElementById("huntUI"); }
async function startHunt(w,mode){
  const H=huntHost(); if(!H||huntBusy) return;
  const ws=wsGet(w);
  const cfg=window.COPILOT_SUPABASE;
  if(!cfg||!cfg.url){ H.innerHTML=`<div class="note">Integrated hunting needs the cloud backend \u2014 use the copy-prompt path instead.</div>`; return; }
  if(!sb||!sbUser){ H.innerHTML=`<div class="note">Sign in (\u2601 under the tabs) to use integrated hunting \u2014 or use the copy-prompt path.</div>`; return; }
  huntBusy=true;
  const t0=Date.now(); let phase=0;
  H.innerHTML=`<div class="huntbox"><div class="huntphase" id="hPhase">${HUNT_PHASES[0][0]}</div>
    <div class="huntbar"><div class="huntfill"></div></div>
    <div class="huntmeta" id="hMeta">${mode==="extended"?"Extended hunt \u2014 verifying on official sites; this can take a couple of minutes.":"Basic hunt \u2014 up to 25 candidates, usually under a minute."}</div></div>`;
  const tick=setInterval(()=>{
    const s=Math.round((Date.now()-t0)/1000);
    while(phase<HUNT_PHASES.length-1&&s>=HUNT_PHASES[phase][1]) phase++;
    const p=document.getElementById("hPhase"),m=document.getElementById("hMeta");
    if(p) p.textContent=HUNT_PHASES[phase][0];
    if(m) m.textContent=(mode==="extended"?"Extended hunt":"Basic hunt")+" \u00b7 "+s+"s elapsed";
  },1000);
  try{
    const {data:{session}}=await sb.auth.getSession();
    const prior=[...new Set([...data.map(c=>c.acr),...((lastHunt&&lastHunt.w===w)?lastHunt.venues.map(v=>v.acr):[])])];
    const res=await fetch(cfg.url+"/functions/v1/venue-hunt",{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:cfg.anonKey,Authorization:"Bearer "+(session&&session.access_token||"")},
      body:JSON.stringify({mode,prior:prior.slice(0,80),
        paper:{w,title:ws.title||ws.short||ws.label,stage:ws.tag,keywords:ws.keywords||[]},
        profile:{name:prof.name,stage:(prof.meta&&prof.meta.stage)||"",country:(prof.meta&&prof.meta.country)||""}})
    });
    const out=await res.json().catch(()=>({error:"unreadable response"}));
    clearInterval(tick); huntBusy=false;
    if(!res.ok||out.error){
      const msg=res.status===404?"The venue-hunt backend isn\u2019t deployed yet (see supabase/README.md)":out.error||("error "+res.status);
      H.innerHTML=`<div class="note"><b>Hunt unavailable:</b> ${esc(String(msg))}. The copy-prompt path still works.</div>`;
      return;
    }
    lastHunt={w,mode,venues:out.digest.venues};
    renderHuntResults(w,out);
  }catch(e){
    clearInterval(tick); huntBusy=false;
    H.innerHTML=`<div class="note"><b>Hunt failed:</b> ${esc(String(e&&e.message||e))}. The copy-prompt path still works.</div>`;
  }
}
function renderHuntResults(w,out){
  const H=huntHost(); if(!H) return;
  const have=new Set(data.map(c=>c.id));
  const vs=out.digest.venues.filter(v=>!have.has(v.id));
  H.innerHTML=`<div class="group-h" style="margin-top:16px">${out.mode==="extended"?"Extended":"Basic"} hunt \u2014 ${vs.length} venue${vs.length===1?"":"s"} found</div>
    ${out.summary?`<p class="sub">${esc(out.summary)}</p>`:""}
    ${vs.length?vs.map(v=>`<div class="dl-row">
      <span class="date mono">${fmt(v.dl)}</span>
      <span class="who"><b>${esc(v.acr)}</b> <span class="m">\u00b7 ${esc((v.name||"").slice(0,60))} \u00b7 ${esc(v.city||"")}</span> ${v.approx?'<span class="verify">verify</span>':""}</span>
      ${v.url?`<a href="${esc(v.url)}" target="_blank" rel="noopener">site \u2197</a>`:""}
      <button class="btn hadd" data-id="${esc(v.id)}">Add</button>
    </div>`).join(""):"<p class='sub'>Nothing new beyond what you already track.</p>"}
    <div class="editbtns" style="margin-top:12px">
      ${out.mode==="basic"?`<button class="btn primary" id="huntExt">\ud83d\udd0e Extended hunt \u2014 verify deadlines &amp; portals</button>`:""}
      <button class="btn" id="huntAddAll">Add all</button>
    </div>`;
  const grab=id=>{ const v=out.digest.venues.find(x=>x.id===id); if(!v) return;
    if(data.some(c=>c.id===v.id)) return;
    data.push({...v,myFits:[w],status:"watching",notes:""}); save(); };
  H.querySelectorAll(".hadd").forEach(b=>b.addEventListener("click",()=>{ grab(b.dataset.id); b.textContent="Added \u2713"; b.disabled=true; renderDash(); renderPipe(); }));
  const all=document.getElementById("huntAddAll");
  if(all) all.addEventListener("click",()=>{ vs.forEach(v=>grab(v.id)); renderDash(); renderPipe(); renderMatch(w); });
  const ext=document.getElementById("huntExt");
  if(ext) ext.addEventListener("click",()=>startHunt(w,"extended"));
}

// ---- sign-in dialog (no native prompt/alert — those are blocked in
// iOS standalone apps and some embedded webviews) ----
function signInDialog(){
  if(!sb) return;
  const d=document.createElement("dialog"); d.style.maxWidth="420px";
  d.innerHTML=`<h2 style="margin:0 0 8px">Sign in to sync</h2>
    <p style="font-size:13px;color:var(--muted);margin:0 0 10px">Enter your email \u2014 we\u2019ll send a one-click sign-in link. Open it on this same device.</p>
    <input id="siEmail" type="email" class="wizf" placeholder="you@example.com" autocomplete="email" inputmode="email">
    <p id="siMsg" style="font-size:13px;margin:10px 0 0;min-height:18px"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button type="button" class="btn" id="siCancel">Cancel</button>
      <button type="button" class="btn primary" id="siSend">Send sign-in link</button>
    </div>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener("close",()=>d.remove());
  d.querySelector("#siCancel").addEventListener("click",()=>d.close());
  const send=async()=>{
    const email=d.querySelector("#siEmail").value.trim();
    const M=d.querySelector("#siMsg");
    if(!email||!email.includes("@")){ M.textContent="Enter a valid email address."; return; }
    M.textContent="Sending\u2026";
    try{
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
      if(error){ M.textContent="Sign-in failed: "+error.message; return; }
      M.textContent="\u2713 Link sent \u2014 check your inbox and open it on this device.";
      d.querySelector("#siSend").disabled=true;
    }catch(e){ M.textContent="Sign-in failed: "+(e&&e.message||e); }
  };
  d.querySelector("#siSend").addEventListener("click",send);
  d.querySelector("#siEmail").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); send(); } });
  d.querySelector("#siEmail").focus();
}
