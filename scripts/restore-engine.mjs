#!/usr/bin/env node
import fs from "node:fs";
import zlib from "node:zlib";
let b64 = "";
for (let i = 0; i < 20; i++) {
  const p = `src/darkhorse/parts/${String(i).padStart(2,"0")}.txt`;
  if (fs.existsSync(p)) b64 += fs.readFileSync(p, "utf8");
}
const buf = zlib.gunzipSync(Buffer.from(b64.replace(/\s+/g, ""), "base64"));
fs.writeFileSync("src/darkhorse/engine.jsx", buf);
console.log("restored engine.jsx", buf.length);
