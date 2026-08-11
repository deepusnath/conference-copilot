// CI sanity checks: script syntax + seed-data invariants.
import {readFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const html=readFileSync("index.html","utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error("no inline <script> found");
writeFileSync("/tmp/copilot-app.js",m[1]);
execFileSync(process.execPath,["--check","/tmp/copilot-app.js"],{stdio:"inherit"});

const store={};
globalThis.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v};
const cut=m[1].indexOf("// tabs");
(0,eval)(m[1].slice(0,cut)+"\nglobalThis.__d={data,STATUSES,TIERS,WSABS};");
const {data,STATUSES,TIERS,WSABS}=globalThis.__d;

const errs=[];
const ids=new Set();
for(const c of data){
  if(ids.has(c.id)) errs.push(`duplicate id ${c.id}`);
  ids.add(c.id);
  if(!TIERS[c.tier]) errs.push(`${c.id}: bad tier ${c.tier}`);
  if(!STATUSES.includes(c.status)) errs.push(`${c.id}: bad status ${c.status}`);
  if(c.dl && !/^\d{4}-\d{2}-\d{2}$/.test(c.dl)) errs.push(`${c.id}: bad deadline ${c.dl}`);
  for(const w of c.fits||[]) if(!WSABS[w]) errs.push(`${c.id}: fits unknown workstream ${w}`);
  if(c.sub && !["portal","verify"].includes(c.sub)) errs.push(`${c.id}: bad sub route ${c.sub}`);
}
if(errs.length){ console.error("DATA ERRORS:\n"+errs.join("\n")); process.exit(1); }
console.log(`OK — syntax valid, ${data.length} entries, invariants hold.`);
