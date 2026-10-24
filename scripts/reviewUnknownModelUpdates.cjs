// Salvage VIN History — read-only review of passenger vehicle model corrections.
// Run from project root: node scripts/reviewUnknownModelUpdates.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
function loadEnv() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
function parseCsv(input) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (quoted) throw new Error('Unterminated CSV quote');
  const headers = rows.shift().map(x => x.replace(/^\uFEFF/, '').trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(headers.map((h,i) => [h, r[i] ?? ''])));
}
const approvedMakes = new Set([
  'acura','bmw','chevrolet','dodge','ferrari','genesis','honda','hyundai',
  'jaguar','land rover','maserati','mazda','mercedes-benz','porsche',
  'rolls-royce','subaru','tesla','toyota','volkswagen','bentley'
]);
const norm = x => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
const missing = x => !x || ['unknown','n/a','null','undefined'].includes(String(x).trim().toLowerCase());
const excludedModels = new Set(['vehicle','passenger car','multipurpose passenger vehicle','incomplete vehicle','chassis','motorhome chassis']);
async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials in .env.local');
  const supabase = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
  const file = path.join(process.cwd(),'data','unknown-models-preview.csv');
  const rows = parseCsv(fs.readFileSync(file,'utf8'));
  const required = ['vin','year','make','decoded_year','decoded_make','decoded_model','error_code','status'];
  if (!rows.length || required.some(k => !(k in rows[0]))) throw new Error('Unexpected CSV columns');
  const eligible = rows.filter(r =>
    r.status === 'READY_FOR_REVIEW' && r.error_code.trim() === '0' &&
    approvedMakes.has(r.make.trim().toLowerCase()) &&
    norm(r.make) === norm(r.decoded_make) &&
    String(r.year) === String(r.decoded_year) &&
    !missing(r.decoded_model) &&
    norm(r.decoded_model) !== norm(r.decoded_make) &&
    !excludedModels.has(r.decoded_model.trim().toLowerCase()) &&
    /^[A-HJ-NPR-Z0-9]{17}$/i.test(r.vin)
  );
  const candidates = [];
  const skipped = [];
  for (const r of eligible) {
    const {data,error} = await supabase.from('vehicles').select('vin,year,make,model').eq('vin',r.vin).maybeSingle();
    if (error) throw new Error(`Supabase lookup failed for ${r.vin}: ${error.message}`);
    if (!data || !missing(data.model) || norm(data.make) !== norm(r.make) || String(data.year) !== String(r.year)) {
      skipped.push({vin:r.vin, reason:'Record changed, missing, or no longer matches'});
      continue;
    }
    candidates.push({vin:r.vin,year:r.year,make:r.make,current_model:data.model,proposed_model:r.decoded_model});
  }
  console.log(`CSV rows: ${rows.length}`);
  console.log(`Eligible passenger-vehicle candidates: ${eligible.length}`);
  console.log(`Still eligible in Supabase: ${candidates.length}`);
  console.log(`Skipped after database recheck: ${skipped.length}`);
  console.table(candidates);
  const out = path.join(process.cwd(),'data','unknown-models-passenger-review.json');
  fs.writeFileSync(out,JSON.stringify({generated_at:new Date().toISOString(),candidates,skipped},null,2));
  console.log(`Review report: ${out}`);
  console.log('READ ONLY: no database updates were made.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
