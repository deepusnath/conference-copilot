// Inline styles.css + seed-data.js + app.js into one self-contained HTML file
// (needed for single-file targets like the claude.ai artifact deployment).
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
const html=readFileSync("index.html","utf8");
const out=html
  .replace('<link rel="stylesheet" href="styles.css">',"<style>\n"+readFileSync("styles.css","utf8")+"</style>")
  .replace('<script src="config.js"></script>',"<script>window.COPILOT_SUPABASE=null;</script>")
  .replace('<script src="seed-data.js"></script>',"")
  .replace('<script src="app.js"></script>',"<script>\n"+readFileSync("seed-data.js","utf8")+"\n"+readFileSync("app.js","utf8")+"</script>");
mkdirSync("dist",{recursive:true});
writeFileSync("dist/copilot-single.html",out);
console.log("bundled dist/copilot-single.html "+out.length+"B");
