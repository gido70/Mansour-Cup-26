/* Minimal CSV + utils (no external libs) */
const CSV = (() => {
  function splitCSVLine(line){
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ){
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }
  function parse(text){
    const lines = text.replace(/\r/g,"").split("\n").filter(l=>l.trim().length>0);
    if (!lines.length) return [];
    const headers = splitCSVLine(lines[0]).map(h => h.trim());
    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = splitCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h,idx)=> obj[h] = (cols[idx] ?? "").trim());
      rows.push(obj);
    }
    return rows;
  }
  function toCSV(rows, headers){
    const h = headers ?? Object.keys(rows?.[0] ?? {});
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const lines = [];
    lines.push(h.map(esc).join(","));
    for (const r of rows){
      lines.push(h.map(k=>esc(r[k])).join(","));
    }
    return lines.join("\n");
  }
  return { parse, toCSV };
})();

const U = (() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const num = (v) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const dateKey = (iso) => {
    // iso: YYYY-MM-DD
    return String(iso ?? "").trim();
  };
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y,m,d] = iso.split("-").map(x=>parseInt(x,10));
    if (!y||!m||!d) return iso;
    // Arabic-ish formatting
    return `${d.toString().padStart(2,"0")}/${m.toString().padStart(2,"0")}/${y}`;
  };
  const toast = (msg) => {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 2600);
  };
  const groupBy = (arr, keyFn) => {
    const m = new Map();
    for (const x of arr){
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  return { $, $$, num, dateKey, fmtDate, toast, groupBy };
})();