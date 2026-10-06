// 보고서 조립: report-body.html 의 자리표시자에 mock.css / mocks.html / ui-diff-check.txt 를 끼워 넣는다.
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const out = path.join(dir, "..");
const body = fs.readFileSync(path.join(dir, "report-body.html"), "utf8");
const css = fs.readFileSync(path.join(dir, "mock.css"), "utf8");
const mocks = fs.readFileSync(path.join(dir, "mocks.html"), "utf8");
const diff = fs.readFileSync(path.join(out, "evidence", "ui-diff-check.txt"), "utf8");
const parts = {};
for (const m of mocks.matchAll(/<!-- ===== MOCK (\d) :[^>]*-->([\s\S]*?)(?=<!-- ===== MOCK \d|$)/g)) parts[m[1]] = m[2].trim();
let html = body.replace("<!--MOCKCSS-->", css).replace("<!--DIFFCHECK-->", diff.replace(/</g, "&lt;"));
for (let i = 1; i <= 6; i++) {
  if (!parts[i]) throw new Error("mock " + i + " missing");
  html = html.replace(`<!--MOCK:${i}-->`, parts[i]);
}
if (/<!--MOCK/.test(html)) throw new Error("placeholder left");
fs.writeFileSync(path.join(out, "kride-six-screens-ui-benchmark.html"), html);
// 목업만 따로 보는 독립 파일
fs.writeFileSync(path.join(out, "after-expected-mock.html"),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KRIDE 기대 화면 목업 6종</title><style>body{margin:0;padding:16px;background:#e9e7e2;display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;align-items:start}${css}</style></head><body>${mocks}</body></html>`);
console.log("ok", Object.keys(parts).join(","));
