
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

const TEST_MODE = process.argv.includes("--test");
const BATCH_SIZE = TEST_MODE ? 10 : 2000;
const PAUSE_MS = 1500;
const MAX_RETRIES = 5;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let totalUpdated = 0;
  let batchNumber = 0;
  let consecutiveFailures = 0;

  while (true) {
    const { data, error } = await supabase.rpc(
      "backfill_vehicle_auction_dates",
      { p_batch_size: BATCH_SIZE }
    );

    if (error) {
      consecutiveFailures++;

      console.error(
        `Batch failed (${consecutiveFailures}/${MAX_RETRIES}):`,
        error.message
      );

      if (consecutiveFailures >= MAX_RETRIES) {
        throw new Error("Too many consecutive failures.");
      }

      await sleep(5000 * consecutiveFailures);
      continue;
    }

    consecutiveFailures = 0;

    const updated = Number(data);

    if (!Number.isInteger(updated) || updated < 0) {
      throw new Error(`Unexpected RPC result: ${JSON.stringify(data)}`);
    }

    if (updated === 0) {
      console.log("Backfill completed.");
      break;
    }

    batchNumber++;
    totalUpdated += updated;

    console.log(
      `Batch ${batchNumber}: ${updated} vehicles updated | ` +
      `Total this run: ${totalUpdated}`
    );

    if (TEST_MODE) {
  console.log("Test completed successfully. Stopping after one batch.");
  break;
}

await sleep(PAUSE_MS);
  }

  console.log(`Finished. Updated ${totalUpdated} vehicles.`);
}

main().catch((error) => {
  console.error("Backfill stopped:", error.message);
  process.exitCode = 1;
});
