// Builds data/cfp-feed.json (current relevant CFPs) and data/changes.json
// (what's new or changed vs the previous feed) from all scrapers.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {scrapeWikiCFP} from "./scrape-wikicfp.mjs";

const today=new Date().toISOString().slice(0,10);
let prev={venues:[]};
try{ prev=JSON.parse(readFileSync("data/cfp-feed.json","utf8")); }catch{}

const scraped=await scrapeWikiCFP();
if(!scraped.length){
  console.error("All scrapers returned nothing — keeping previous feed untouched.");
  process.exit(0);
}
scraped.sort((a,b)=>(a.dl||"9999").localeCompare(b.dl||"9999"));
const feed={type:"copilot-scout-digest",version:1,date:today,source:"scrapers",venues:scraped.slice(0,200)};

const prevById=new Map((prev.venues||[]).map(v=>[v.id,v]));
const added=feed.venues.filter(v=>!prevById.has(v.id)).map(v=>v.id);
const changed=feed.venues.filter(v=>prevById.has(v.id)&&prevById.get(v.id).dl!==v.dl)
  .map(v=>({id:v.id,from:prevById.get(v.id).dl,to:v.dl}));

mkdirSync("data",{recursive:true});
writeFileSync("data/cfp-feed.json",JSON.stringify(feed,null,1));
writeFileSync("data/changes.json",JSON.stringify({date:today,added,changed},null,1));
console.log(`feed: ${feed.venues.length} venues (${added.length} new, ${changed.length} deadline changes)`);
