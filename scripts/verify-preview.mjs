import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
// Isolated rendering check: uses the real preview component, without mocking WebGL.
// This does not replace the opt-in Supabase two-customer acceptance suite.
const result = await build({
  stdin: {
    contents: `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Preview from './src/components/seat-preview';
const seats=Array.from({length:24},(_,i)=>({id:String(i),category_id:'numbered',section:'Main',row_label:String.fromCharCode(65+Math.floor(i/6)),row_index:Math.floor(i/6),seat_number:i%6+1,columns:6,label:String.fromCharCode(65+Math.floor(i/6))+(i%6+1),available:true}));
function App(){const [index,setIndex]=useState(0);return <main style={{maxWidth:900,margin:'auto',fontFamily:'sans-serif'}}><h1>Demo hall preview check</h1><button onClick={()=>setIndex(0)}>Front row</button><button onClick={()=>setIndex(18)}>Rear row</button><Preview seat={seats[index]} seats={seats}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);
`,
    resolveDir: process.cwd(),
    loader: "tsx",
    sourcefile: "preview-check.tsx",
  },
  bundle: true,
  format: "iife",
  jsx: "automatic",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/bundle.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/bundle.js"
      ? result.outputFiles[0].text
      : '<!doctype html><html><head><meta charset="utf-8"><title>Preview check</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByLabel("Approximate stage view from A1").waitFor();
  mkdirSync(".qa", { recursive: true });
  const front = await page
    .locator("canvas")
    .screenshot({ path: ".qa/preview-front.png" });
  await page.getByRole("button", { name: "Rear row" }).click();
  await page.getByLabel("Approximate stage view from D1").waitFor();
  const rear = await page
    .locator("canvas")
    .screenshot({ path: ".qa/preview-rear.png" });
  assert.ok(
    !front.equals(rear),
    "Front and rear cameras must render differently.",
  );
  console.log(
    "PASS actual WebGL rendering and distinct front/rear audience viewpoints",
  );
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes("webgl") ? null : original.call(this, type, ...args);
    };
  });
  await fallback.goto(url);
  await fallback
    .getByText("3D is unavailable on this device.", { exact: false })
    .waitFor();
  await fallback.getByRole("button", { name: "Rear row" }).click();
  await fallback
    .getByText("Approximate audience view from Main D1.", { exact: false })
    .waitFor();
  console.log(
    "PASS unsupported-WebGL explanation and usable selection controls",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
