#!/usr/bin/env node
import fs from "node:fs";
import zlib from "node:zlib";
const b64 = fs.readFileSync("src/darkhorse/engine.jsx.gz.b64", "utf8");
const buf = zlib.gunzipSync(Buffer.from(b64, "base64"));
fs.writeFileSync("src/darkhorse/engine.jsx", buf);
console.log("restored engine.jsx", buf.length);
