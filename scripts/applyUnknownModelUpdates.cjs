// Salvage VIN History — reviewed model recovery
// Default: dry run. Run with --apply to write to Supabase.
// Run from project root: node --env-file=.env.local scripts/applyUnknownModelUpdates.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const apply = process.argv.includes('--apply');
const input = path.resolve(process.cwd(), 'data/unknown-models-passenger-review.json');
const output = path.resolve(process.cwd(), `data/unknown-models-${apply ? 'applied' : 'dry-run'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const excluded = new Set(['WD0PE745185226147', 'W1Y4ECHY5MT069376']);
const missing = (v) => v == null || ['','unknown','n/a','null','undefined'].includes(String(v).trim().toLowerCase());
const norm = (v) => String(v ?? '').trim().toLowerCase();

async function main() {
  if (!fs.existsSync(input)) throw new Error(`Missing reviewed file: ${input}`);
  const reviewed = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(reviewed.candidates) || reviewed.candidates.length !== 81) {
    throw new Error('Expected exactly 81 reviewed candidates. Stop and re-review this input.');
  }
  const candidates = reviewed.candidates.filter(c => !excluded.has(c.vin));
  if (candidates.length !== 79 || new Set(candidates.map(c => c.vin)).size !== 79) {
    throw new Error('Expected 79 distinct passenger-vehicle candidates.');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or server-side secret key. Use node --env-file=.env.local.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const log = [];
  for (const c of candidates) {
    const result = { vin: c.vin, make: c.make, year: c.year, proposed_model: c.proposed_model };
    try {
      if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(c.vin) || missing(c.proposed_model) || !missing(c.current_model)) {
        result.status = 'SKIPPED_INVALID_REVIEW'; log.push(result); continue;
      }
      const { data: current, error: readError } = await db.from('vehicles')
        .select('vin,year,make,model').eq('vin', c.vin).maybeSingle();
      if (readError) throw readError;
      if (!current || Number(current.year) !== Number(c.year) || norm(current.make) !== norm(c.make) || !missing(current.model)) {
        result.status = 'SKIPPED_CHANGED'; result.current = current; log.push(result); continue;
      }
      result.previous_model = current.model;
      if (!apply) { result.status = 'WOULD_UPDATE'; log.push(result); continue; }
      // Guard against a concurrent change to model, make or year.
      let query = db.from('vehicles').update({ model: c.proposed_model })
        .eq('vin', c.vin).eq('make', current.make).eq('year', current.year);
      query = current.model == null ? query.is('model', null) : query.eq('model', current.model);
      const { data: changed, error: updateError } = await query.select('vin,model');
      if (updateError) throw updateError;
      result.status = changed?.length === 1 && changed[0].model === c.proposed_model ? 'UPDATED' : 'SKIPPED_CONCURRENT_CHANGE';
    } catch (err) {
      result.status = 'ERROR'; result.error = err.message;
    }
    log.push(result);
    console.log(`${log.length}/${candidates.length} ${result.status}: ${c.vin} -> ${c.proposed_model}`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', generated_at: new Date().toISOString(), results: log }, null, 2));
  const counts = log.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('\nSummary:', counts);
  console.log('Audit report:', output);
  if (counts.ERROR) process.exitCode = 1;
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
