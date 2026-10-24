// Preview-only VIN model recovery for Salvage VIN History.
// Run from the vin-site project root: node scripts/previewUnknownModels.cjs
// Requires Node.js 18+ and existing @supabase/supabase-js dependency.
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

function loadLocalEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadLocalEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const unknown = v => !v || v.trim().toLowerCase() === 'unknown';
const normalize = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';

async function getUnknownVehicles() {
  const all = new Map();
  for (const field of ['model']) {
    for (const filter of [q => q.is(field, null), q => q.eq(field, ''), q => q.ilike(field, 'unknown')]) {
      let from = 0;
      while (true) {
        const { data, error } = await filter(supabase.from('vehicles').select('vin,year,make,model')).range(from, from + 999);
        if (error) throw error;
        for (const vehicle of data) if (unknown(vehicle.model)) all.set(vehicle.vin, vehicle);
        if (data.length < 1000) break;
        from += 1000;
      }
    }
  }
  return [...all.values()].sort((a, b) => a.vin.localeCompare(b.vin));
}

async function decode(vin) {
  const endpoint = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (!json.Results?.[0]) throw new Error('No decoder result');
      return json.Results[0];
    } catch (error) {
      if (attempt === 3) throw error;
      await wait(2000 * attempt);
    }
  }
}

async function main() {
  const vehicles = await getUnknownVehicles();
  console.log(`Found ${vehicles.length} vehicles with unknown models.`);
  const rows = [];
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    let decodedYear = '', decodedMake = '', decodedModel = '', errorCode = '', status = '', notes = '';
    try {
      const d = await decode(v.vin);
      decodedYear = d.ModelYear || '';
      decodedMake = d.Make || '';
      decodedModel = d.Model || '';
      errorCode = d.ErrorCode || '';
      const codeOk = errorCode.split(',').map(x => x.trim()).every(x => x === '0');
      const yearOk = String(v.year || '') === String(decodedYear);
      const makeOk = normalize(v.make) === normalize(decodedMake);
      const modelOk = !unknown(decodedModel) && decodedModel.trim().length > 0;
      status = codeOk && yearOk && makeOk && modelOk ? 'READY_FOR_REVIEW' : 'MANUAL_REVIEW';
      notes = [!codeOk && `decoder code ${errorCode}`, !yearOk && 'year mismatch', !makeOk && 'make mismatch', !modelOk && 'model missing'].filter(Boolean).join('; ');
    } catch (error) {
      status = 'DECODE_FAILED';
      notes = error.message;
    }
    rows.push({ vin: v.vin, year: v.year, make: v.make, current_model: v.model, decoded_year: decodedYear, decoded_make: decodedMake, decoded_model: decodedModel, error_code: errorCode, status, notes });
    if ((i + 1) % 20 === 0 || i + 1 === vehicles.length) console.log(`Processed ${i + 1}/${vehicles.length}`);
    await wait(350);
  }
  const outputDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'unknown-models-preview.csv');
  const headers = ['vin','year','make','current_model','decoded_year','decoded_make','decoded_model','error_code','status','notes'];
  fs.writeFileSync(outputFile, [headers.join(','), ...rows.map(row => headers.map(h => csvCell(row[h])).join(','))].join('\r\n') + '\r\n', 'utf8');
  const counts = rows.reduce((acc, row) => (acc[row.status] = (acc[row.status] || 0) + 1, acc), {});
  console.log('\nPreview results:', counts);
  console.log(`CSV report: ${outputFile}`);
  console.log('No database changes were made.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
