// Executes config+seed+app in a permissive DOM stub, as a browser would,
// to catch load-order/TDZ errors that node --check cannot see.
import {readFileSync} from "node:fs";
const mkEl=()=>new Proxy(function(){},{get:(t,p)=>{
  if(["addEventListener","prepend","appendChild","after","setAttribute","showModal","close","remove","scrollIntoView","focus","click"].includes(p)) return ()=>{};
  if(p==="querySelectorAll") return ()=>[];
  if(["querySelector","getElementById","createElement"].includes(p)) return ()=>mkEl();
  if(p==="classList") return {add:()=>{},remove:()=>{},contains:()=>false};
  if(p==="dataset"||p==="style") return {};
  if(p==="value") return "";
  if(p==="hidden") return false;
  if(p===Symbol.toPrimitive) return ()=>"";
  return mkEl();
},set:()=>true});
globalThis.document=new Proxy({},{get:(t,p)=>{
  if(["getElementById","createElement","querySelector"].includes(p)) return ()=>mkEl();
  if(p==="querySelectorAll") return ()=>[];
  if(p==="addEventListener") return ()=>{};
  if(p==="body") return mkEl();
  return mkEl();
}});
globalThis.window=globalThis;
globalThis.location={hash:"",origin:"https://x",pathname:"/"};
Object.defineProperty(globalThis,"navigator",{value:{clipboard:{writeText:async()=>{}}},configurable:true});
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
globalThis.confirm=()=>false; globalThis.alert=()=>{}; globalThis.prompt=()=>null;
globalThis.CSS={escape:s=>s};
const src=["config.js","seed-data.js","app.js"].map(f=>readFileSync(f,"utf8")).join("\n;\n");
(0,eval)(src);
console.log("boot smoke: OK (no top-level exception)");
