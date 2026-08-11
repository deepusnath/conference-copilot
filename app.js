// App logic. Content/data lives in seed-data.js.
const KEY="cqe-conf-tracker-v2";
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
function save(){ try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){} }
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
  const ws=WS[w];
  document.getElementById("matchTitle").textContent="Venue matches — "+ws.name;
  document.getElementById("matchNote").textContent=ws.note;
  const list=data.filter(c=>(c.fits||[]).includes(w));
  document.getElementById("matchList").innerHTML=groupedCards(list,"");
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
      ${(c.fits||[]).map(w=>`<span class="tag">W${w}</span>`).join("")}
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
  const j=c.kind==="journal";
  return `You are my Research Conference CoPilot (WRITER role). Tailor the master abstract below for a submission to ${c.name} (${c.acr})${j?"":" \u2014 "+c.city+", event "+fmt(c.event)+", deadline "+fmt(c.dl)}.\n\nRESEARCHER: ${PROFILE}\n\nVENUE: ${c.url||c.subUrl||"(look up the official site)"} \u2014 first fetch the venue's current CFP/author guidelines and follow its theme, track names, word limit, and required structure exactly. Flag the exact submission route (portal URL or email address) you find.\n\nMASTER ABSTRACT (workstream W${w}):\nTitle: ${WSABS[w].title}\nAuthors: ${WSABS[w].authors}\n${WSABS[w].abs}\n\nRULES: keep every claim faithful to the master \u2014 never invent findings, data, or results${w===2?" (this study has NO results until Dec 2026)":""}; keep it a ${j?"journal-ready":"conference"} abstract; return the tailored abstract, 5\u20138 keywords, the recommended track, and a submission checklist.`;
}
function emailBody(c,w,draft){
  return `Dear ${c.acr} Organising Committee,\n\nPlease find below our abstract for consideration${c.kind==="journal"?"":" for "+c.name+(c.event?" ("+fmt(c.event)+")":"")}.\n\nTitle: ${WSABS[w].title}\nAuthors: ${WSABS[w].authors}\nAffiliation: Amrita School of Business, Bangalore, India\nCorresponding author: Deepu S. Nath (deepu@fayausa.com)\n\nAbstract:\n${draft}\n\nPlease let us know if any additional information or format is required.\n\nWith kind regards,\nDeepu S. Nath\nPhD Research Scholar, Amrita School of Business, Bangalore`;
}
async function copyText(t,btn,label){ try{ await navigator.clipboard.writeText(t); const o=btn.textContent; btn.textContent="Copied \u2713"; setTimeout(()=>btn.textContent=label||o,1500);}catch(e){ alert("Copy failed \u2014 select and copy manually."); } }
function openDraft(id,focusSubmit){
  const c=data.find(x=>x.id===id); if(!c) return;
  const wsOpts=(c.fits&&c.fits.length?c.fits:[2]);
  let w=c.draftWs&&wsOpts.includes(c.draftWs)?c.draftWs:wsOpts[0];
  const d=document.createElement("dialog"); d.style.maxWidth="640px";
  const route=c.sub==="portal"
    ?`<div class="note blue" style="margin:10px 0"><b>Route decided: online portal.</b> ${esc(c.subNote||"")} ${c.subUrl?`<div style="margin-top:8px"><a class="btn" style="text-decoration:none;display:inline-block" href="${esc(c.subUrl)}" target="_blank" rel="noopener">Open submission portal \u2197</a></div>`:""}<div style="margin-top:6px;font-size:12.5px">Email below is a cover/query template only \u2014 this venue does not take submissions by email.</div></div>`
    :`<div class="note" style="margin:10px 0"><b>Submission route not verified.</b> Check the official CFP for the portal or the announced submission address \u2014 fill "To" only from the official page, never from a guess.</div>`;
  d.innerHTML=`<h2 style="margin:0 0 2px">${esc(c.acr)} \u2014 draft &amp; submit</h2>
    <p style="margin:0 0 10px;color:var(--muted);font-size:13px">${esc(c.name)}</p>
    <label style="font-size:12.5px;font-weight:600">Paper (workstream)</label>
    <select id="dWs" style="font:inherit;margin:4px 0 8px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink)">${wsOpts.map(x=>`<option value="${x}" ${x===w?"selected":""}>W${x} \u2014 ${esc(WSABS[x].title.slice(0,60))}\u2026</option>`).join("")}</select>
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
  const setDraft=()=>{ ta.value=(c.drafts&&c.drafts[w])||WSABS[w].title+"\n\n"+WSABS[w].abs; };
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
    location.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent("Abstract submission \u2014 "+c.acr+": "+WSABS[w].title)+"&body="+encodeURIComponent(emailBody(c,w,ta.value).slice(0,1800));
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
document.querySelectorAll(".matchbtn").forEach(b=>b.addEventListener("click",()=>renderMatch(+b.dataset.ws)));
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
        save(); renderDash(); renderPipe();
      }
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
