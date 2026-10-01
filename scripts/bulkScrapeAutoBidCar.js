const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const urlsFile = path.join(
  process.cwd(),
  "data",
  "autobidcar-urls.txt"
);

if (!fs.existsSync(urlsFile)) {
  console.error("Could not find data/autobidcar-urls.txt");
  process.exit(1);
}

const urls = fs
  .readFileSync(urlsFile, "utf8")
  .split(/\r?\n/)
  .map((url) => url.trim())
  .filter((url) => url && !url.startsWith("#"));

if (urls.length === 0) {
  console.error("No URLs found.");
  process.exit(1);
}

console.log(`Found ${urls.length} vehicle URLs.\n`);

let successful = 0;
let failed = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];

  console.log("========================================");
  console.log(`Vehicle ${i + 1} of ${urls.length}`);
  console.log(url);
  console.log("========================================\n");

  const result = spawnSync(
    process.execPath,
    ["scripts/scrapeAutoBidCar.js", url],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );

  if (result.status === 0) {
    successful++;

    console.log(
      `\n✓ Vehicle ${i + 1} completed successfully.\n`
    );
  } else {
    failed++;

    console.error(
      `\n✗ Vehicle ${i + 1} failed. Continuing...\n`
    );
  }
}

console.log("\n========================================");
console.log("BULK IMPORT COMPLETE");
console.log("========================================");
console.log(`Total:      ${urls.length}`);
console.log(`Successful: ${successful}`);
console.log(`Failed:     ${failed}`);
console.log("========================================");

if (failed > 0) {
  process.exitCode = 1;
}