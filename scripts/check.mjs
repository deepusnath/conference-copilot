// CI sanity checks: module syntax + seed-data invariants + bundle build.
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

for(const f of ["seed-data.js","app.js","config.js"])
  execFileSync(process.execPath,["--check",f],{stdio:"inherit"});

(0,eval)(readFileSync("seed-data.js","utf8")+"\nglobalThis.__d={SEED,STATUSES,TIERS,DEFAULT_PROFILE};");
const {SEED,STATUSES,TIERS,DEFAULT_PROFILE}=globalThis.__d;
const WSABS=Object.fromEntries(DEFAULT_PROFILE.workstreams.map(x=>[x.w,x]));

const errs=[]; const ids=new Set();
for(const c of SEED){
  if(ids.has(c.id)) errs.push(`duplicate id ${c.id}`);
  ids.add(c.id);
  if(!TIERS[c.tier]) errs.push(`${c.id}: bad tier ${c.tier}`);
  if(!STATUSES.includes(c.status)) errs.push(`${c.id}: bad status ${c.status}`);
  if(c.dl && !/^\d{4}-\d{2}-\d{2}$/.test(c.dl)) errs.push(`${c.id}: bad deadline ${c.dl}`);
  for(const w of c.fits||[]) if(!WSABS[w]) errs.push(`${c.id}: fits unknown workstream ${w}`);
  if(c.sub && !["portal","verify"].includes(c.sub)) errs.push(`${c.id}: bad sub route ${c.sub}`);
}
if(errs.length){ console.error("DATA ERRORS:\n"+errs.join("\n")); process.exit(1); }

execFileSync(process.execPath,["scripts/boot-smoke.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/bundle.mjs"],{stdio:"inherit"});
console.log(`OK — modules valid, ${SEED.length} seed entries, invariants hold, bundle builds.`);
