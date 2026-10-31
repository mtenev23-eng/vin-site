
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const MODEL_DISPLAY_NAMES = {
  "2ER": "2 Series",
  "3ER": "3 Series",
  "4ER": "4 Series",
  "5ER": "5 Series",
  "6ER": "6 Series",
  "7ER": "7 Series",
  "8ER": "8 Series",
  "A-KLASSE": "A-Class",
  "A-CLASS": "A-Class",
  "C-KLASSE": "C-Class",
  "C-CLASS": "C-Class",
  "E-KLASSE": "E-Class",
  "E-CLASS": "E-Class",
  "S-KLASSE": "S-Class",
  "S-CLASS": "S-Class",
  "GLE": "GLE",
  "GLE-CLASS": "GLE",
  "GLC": "GLC",
  "GLC-CLASS": "GLC",
  "GLS-KLASSE": "GLS",
  "GLS-CLASS": "GLS",
  "GLA-KLASSE": "GLA",
  "GLA-CLASS": "GLA",
  "GLB": "GLB",
  "GLB-CLASS": "GLB",
  "CLA-KLASSE": "CLA",
  "CLA-CLASS": "CLA",
  "CLS-KLASSE": "CLS",
  "CLS-CLASS": "CLS",
  "G-KLASSE": "G-Class",
  "G-CLASS": "G-Class",
  "SL-KLASSE": "SL",
  "SL-CLASS": "SL",
  "SLK-KLASSE": "SLK",
  "SLK-CLASS": "SLK",
  "SLC-CLASS": "SLC",
  "GLK-CLASS": "GLK",
  "GL-CLASS": "GL",
  "CL-CLASS": "CL",
  "ML-CLASS": "ML",
  "AMG-CLASS": "AMG",
  "AMG GT": "AMG GT",
};

function displayModel(model) {
  return MODEL_DISPLAY_NAMES[model.trim().toUpperCase()] || model.trim();
}

function normalizeModelName(make, model) {
  const cleaned = model.trim();
  const upper = cleaned.toUpperCase();

  if (make === "BMW") return displayModel(cleaned);

  if (make === "TESLA") {
    const map = {
      "MODEL 3": "Model 3",
      "MODEL Y": "Model Y",
      "MODEL S": "Model S",
      "MODEL X": "Model X",
      CYBERTRUCK: "Cybertruck",
    };
    return map[upper] || cleaned;
  }

  if (make === "MERCEDES-BENZ") {
    return MODEL_DISPLAY_NAMES[upper] || cleaned;
  }

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugifyModel(model) {
  return displayModel(model)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getModels(make) {
  const { data, error } = await supabase.rpc(
    "get_vehicle_model_counts",
    { requested_make: make }
  );

  if (error) throw error;

  return data || [];
}

function buildGroups(make, rows) {
  const grouped = new Map();

  for (const row of rows) {
    const model = row.model;
    const count = Number(row.vehicle_count);
    if (!model || !Number.isFinite(count) || count <= 0) continue;

    const name = normalizeModelName(make, model);
    const key = name.toLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        name,
        count: 0,
        rawModels: new Set(),
      });
    }

    const group = grouped.get(key);
    group.count += count;
    group.rawModels.add(model);
  }

  if (make === "BMW") {
    const bmwGroups = {
      "1-series": "1",
      "2-series": "2",
      "3-series": "3",
      "4-series": "4",
      "5-series": "5",
      "6-series": "6",
      "7-series": "7",
      "8-series": "8",
      "z-series": "Z",
      "x-series": "X",
      m: "M",
    };

    const special = [];

    for (const [slug, prefix] of Object.entries(bmwGroups)) {
      const matching = rows.filter((row) =>
        displayModel(row.model)
          .toUpperCase()
          .startsWith(prefix.toUpperCase())
      );

      const count = matching.reduce(
        (sum, row) => sum + Number(row.vehicle_count),
        0
      );

      if (count >= 5) {
        special.push({
          slug,
          count,
          rawModels: [...new Set(matching.map((row) => row.model))],
        });
      }
    }

    const specialSlugs = new Set(special.map((group) => group.slug));

    return [
      ...special,
      ...[...grouped.values()]
        .filter(
          (group) =>
            group.count >= 5 &&
            !specialSlugs.has(slugifyModel(group.name))
        )
        .map((group) => ({
          slug: slugifyModel(group.name),
          count: group.count,
          rawModels: [...group.rawModels],
        })),
    ];
  }

  return [...grouped.values()]
    .filter((group) => group.count >= 5)
    .map((group) => ({
      slug: slugifyModel(group.name),
      count: group.count,
      rawModels: [...group.rawModels],
    }));
}

async function main() {
  console.log("READ-ONLY DRY RUN — no database writes\n");

  for (const make of ["BMW", "TESLA"]) {
    const rows = await getModels(make);
    const groups = buildGroups(make, rows);

    console.log(`${make}: ${groups.length} model groups`);

    for (const group of groups.slice(0, 12)) {
      console.log({
        slug: group.slug,
        vehicleCount: group.count,
        rawModels: group.rawModels,
      });
    }

    console.log("");
  }
}

const SUPPORTED_MAKES = {
  toyota: "TOYOTA",
  ford: "FORD",
  honda: "HONDA",
  hyundai: "HYUNDAI",
  bmw: "BMW",
  chevrolet: "CHEVROLET",
  tesla: "TESLA",
  jeep: "JEEP",
  "mercedes-benz": "MERCEDES-BENZ",
  nissan: "NISSAN",
  lexus: "LEXUS",
  kia: "KIA",
  audi: "AUDI",
  porsche: "PORSCHE",
  dodge: "DODGE",
  volkswagen: "VOLKSWAGEN",
  mazda: "MAZDA",
  "land-rover": "LAND ROVER",
  volvo: "VOLVO",
  mitsubishi: "MITSUBISHI",
  buick: "BUICK",
  chrysler: "CHRYSLER",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg
  ? Number(limitArg.split("=")[1])
  : args.includes("--refresh")
    ? 10000
    : 20;

  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
  throw new Error("Limit must be between 1 and 10000.");
}

const { data: cachedRows, error: cacheError } = await supabase
  .from("model_average_bid_cache")
  .select("make_slug, model_slug")
  .limit(10000);

if (cacheError) throw cacheError;

const cachedKeys = new Set(
  cachedRows.map((row) => `${row.make_slug}/${row.model_slug}`)
);

  const jobs = [];

  for (const [makeSlug, make] of Object.entries(SUPPORTED_MAKES)) {
    const rows = await getModels(make);
    const groups = buildGroups(make, rows);

    for (const group of groups) {
      if (
  process.argv.includes("--refresh") ||
  !cachedKeys.has(`${makeSlug}/${group.slug}`)
) {
  jobs.push({ makeSlug, make, ...group });
}
    }
  }

  console.log(`Found ${jobs.length} model groups.`);

  let updated = 0;
  let failed = 0;

 for (const job of jobs.slice(0, limit)) {
    try {
      const { data, error } = await supabase.rpc(
        "get_model_recent_average_bid",
        {
          p_make: job.make,
          p_models: job.rawModels,
        }
      );

      if (error) throw error;

      const { error: writeError } = await supabase
        .from("model_average_bid_cache")
        .upsert({
          make_slug: job.makeSlug,
          model_slug: job.slug,
          average_bid: data === null ? null : Number(data),
          calculated_at: new Date().toISOString(),
        });

      if (writeError) throw writeError;

      updated++;
      console.log(
        `[${updated + failed}/${Math.min(limit, jobs.length)}] ` +
        `${job.makeSlug}/${job.slug}: ${data ?? "N/A"}`
      );
    } catch (error) {
      failed++;
      console.error(
        `Failed ${job.makeSlug}/${job.slug}:`,
        error.message
      );
    }

    await sleep(500);
  }

  console.log(`Finished. Updated: ${updated}, Failed: ${failed}`);
  if (failed > 0) {
  throw new Error(
    `Model average bid refresh incomplete: ${failed} model(s) failed.`
  );
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
