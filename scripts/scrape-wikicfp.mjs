// WikiCFP category scraper → normalized venue objects (scout-digest schema).
// Defensive: any parse failure yields fewer venues, never a crash.
const CATS=["education","psychology","e-learning","educational technology"];
const MONTHS={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const iso=s=>{ const m=/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/.exec(s||""); if(!m) return null;
  return `${m[3]}-${String(MONTHS[m[1]]||0).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`; };
const RELEVANT=/educat|learn|motivat|gamif|psycholog|pedagog|teach|student|mooc|edtech|academ|university|curricul/i;
const fitsFor=t=>{
  const s=t.toLowerCase(), f=new Set();
  if(/gamif|motivat|self.?determ|engagement/.test(s)){f.add(1);f.add(2);f.add(4);}
  if(/higher educ|education polic|management educ|universit/.test(s)) f.add(3);
  if(/learning analytic|artificial intelligence|technolog|e.?learn|online/.test(s)){f.add(2);f.add(4);}
  if(!f.size) f.add(2);
  return [...f].sort();
};
export async function scrapeWikiCFP(){
  const out=new Map();
  for(const cat of CATS){
    try{
      const res=await fetch("http://www.wikicfp.com/cfp/call?conference="+encodeURIComponent(cat),
        {headers:{"User-Agent":"Mozilla/5.0 (conference-copilot scraper; github.com/deepusnath/conference-copilot)"}});
      if(!res.ok){ console.warn(`wikicfp ${cat}: HTTP ${res.status}`); continue; }
      const html=await res.text();
      const re=/<a href="\/cfp\/servlet\/event\.showcfp\?eventid=(\d+)[^"]*">([^<]+)<\/a>[\s\S]{0,200}?colspan="3">([^<]+)<[\s\S]{0,400}?<td align="left">([^<]*)<\/td>\s*<td align="left">([^<]*)<\/td>\s*<td align="left">([^<]*)<\/td>/g;
      let m;
      while((m=re.exec(html))){
        const [,eid,acr,name,when,where,dl]=m.map(x=>String(x||"").trim());
        if(out.has(eid)) continue;
        if(!RELEVANT.test(acr+" "+name)) continue;
        const dlIso=iso(dl), evIso=iso(when);
        if(!dlIso||new Date(dlIso)<new Date()) continue; // only future deadlines
        out.set(eid,{
          id:("wcfp-"+acr.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+eid).slice(0,60),
          acr,name,city:where||"TBA",event:evIso,dl:dlIso,approx:true,tier:2,
          url:"http://www.wikicfp.com/cfp/servlet/event.showcfp?eventid="+eid,
          why:"WikiCFP find (category: "+cat+") — UNVETTED: run the vet checklist (indexing, organisers, predatory signals) before shortlisting.",
          fits:fitsFor(acr+" "+name),sub:"verify",
          src:"wikicfp scraper"
        });
      }
      console.log(`wikicfp ${cat}: total so far ${out.size}`);
    }catch(e){ console.warn(`wikicfp ${cat} failed:`,e.message); }
  }
  return [...out.values()];
}
