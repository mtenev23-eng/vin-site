const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DATA_DIR = path.join(__dirname, "..", "data");

const SUMMARY_FILE = path.join(
  DATA_DIR,
  "opendatacar-last-run.json"
);

const AUTO_STATE_FILE = path.join(
  DATA_DIR,
  "opendatacar-auto-state.json"
);

const CRAWLER_FILE = path.join(
  __dirname,
  "crawlOpenDataCar.js"
);
let runnerInterrupted = false;
const PROGRESS_FILE = path.join(
  DATA_DIR,
  "opendatacar-progress.json"
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 8;
const BASE_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

function getCooldown(attempt) {
  return Math.min(
    BASE_COOLDOWN_MS * 2 ** (attempt - 1),
    MAX_COOLDOWN_MS
  );
}

function getSafeResumePage(make, fallbackPage, runStartedAt) {
  const progress = loadJson(PROGRESS_FILE, null);

  if (
    progress?.mode !== "make" ||
    progress.makeSlug !== make ||
    !Number.isInteger(progress.nextPage) ||
    progress.nextPage < 1 ||
    !progress.updatedAt ||
    Date.parse(progress.updatedAt) < runStartedAt
  ) {
    return fallbackPage;
  }

  // Revisit the previous page so failed vehicles
  // cannot be accidentally left behind.
  return Math.max(
    fallbackPage,
    progress.nextPage - 1
  );
}
process.on("SIGINT", () => {
  if (runnerInterrupted) {
    return;
  }

  runnerInterrupted = true;

  console.log("");
  console.log(
    "Automatic runner received Ctrl+C."
  );
  console.log(
    "Waiting for crawler to save its checkpoint and run summary..."
  );
});
const MAKE_QUEUE = [
  "bmw",
  "mercedes-benz",
  "audi",
  "porsche",
  "lexus",
  "toyota",
  "honda",
  "ford",
  "chevrolet",
  "dodge",
  "jeep",
  "tesla",
  "land-rover",
  "jaguar",
  "cadillac",
  "infiniti",
  "acura",
  "volkswagen",
  "volvo",
  "subaru",
  "mazda",
  "nissan",
  "kia",
  "hyundai",
  "genesis",
  "gmc",
  "ram",
  "buick",
  "chrysler",
  "lincoln",
  "mitsubishi",
  "mini",
  "alfa-romeo",
  "maserati",
  "bentley",
  "aston-martin",
  "ferrari",
  "lamborghini",
  "mclaren",
  "rolls-royce",
  "maybach",
  "lotus",
  "pontiac",
  "mercury",
  "saab",
  "smart",
  "suzuki",
  "fiat",
  "citroen",
  "daihatsu",
  "hummer",
  "mg",
];

fs.mkdirSync(DATA_DIR, {
  recursive: true,
});

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    return fallback;
  }
}

function saveJson(file, value) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      value,
      null,
      2
    ),
    "utf8"
  );
}

function getDefaultState() {
  return {
    currentMakeIndex: 0,

    // BMW pages 1-758 were already crawled
    // during the previous deep BMW run.
    makeStartPages: {
      bmw: 759,
    },

    completedMakes: [],
  };
}

function runCrawler(args = []) {
  return new Promise((resolve) => {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      `STARTING: node scripts\\crawlOpenDataCar.js ${args.join(" ")}`
    );
    console.log(
  "========================================"
);

// Remove any previous run summary so we can never
// mistake stale data for the result of this crawl.
if (fs.existsSync(SUMMARY_FILE)) {
  fs.unlinkSync(SUMMARY_FILE);
}
const runStartedAt = Date.now();
const child = spawn(
      process.execPath,
      [
        CRAWLER_FILE,
        ...args,
      ],
      {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
      }
    );

    child.on("close", (code, signal) => {
  console.log("");
  console.log(
    `Crawler process closed with code=${code} signal=${signal || "none"}`
  );

  resolve({
  code,
  signal,
  runStartedAt,
});
});
  });
}

function readLastSummary() {
  return loadJson(
    SUMMARY_FILE,
    null
  );
}

async function main() {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "OPENDATACAR AUTOMATIC RUNNER"
  );
  console.log(
    "========================================"
  );
  console.log(
    "Priority 1: Recent sold archive"
  );
  console.log(
    "Priority 2: Deep make-by-make backfill"
  );
  console.log(
    "Minimum auction date: 2026-01-01"
  );
  console.log(
    "========================================"
  );

  // ========================================
  // 1. RECENT ARCHIVE FIRST
  // ========================================

  console.log("");
  console.log(
    ">>> STARTING RECENT SOLD ARCHIVE"
  );

let recentComplete = false;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  if (runnerInterrupted) return;

  const result = await runCrawler([]);
  const summary = readLastSummary();

  if (runnerInterrupted) return;

  if (
    result.code === 0 &&
    !result.signal &&
    summary?.status === "completed" &&
    ["empty_catalog", "old_date_cutoff"].includes(
      summary.stopReason
    )
  ) {
    recentComplete = true;
    break;
  }

  console.error(
    `Recent archive failed. Attempt ${attempt}/${MAX_RETRIES}.`
  );

  if (attempt < MAX_RETRIES) {
    const cooldown = getCooldown(attempt);

    console.log(
      `Cooling down for ${Math.round(cooldown / 1000)} seconds...`
    );

    await sleep(cooldown);
  }
}

if (!recentComplete) {
  console.error(
    "Recent archive could not complete after repeated attempts."
  );

  process.exitCode = 1;
  return;
}
  console.log("");
  console.log(
    ">>> RECENT ARCHIVE COMPLETE"
  );

  // ========================================
  // 2. MAKE-BY-MAKE BACKFILL
  // ========================================

  const state =
    loadJson(
      AUTO_STATE_FILE,
      getDefaultState()
    );

  while (
    state.currentMakeIndex <
    MAKE_QUEUE.length
  ) {
    const make =
      MAKE_QUEUE[
        state.currentMakeIndex
      ];

    const startPage =
      state.makeStartPages[make] || 1;

    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      `>>> MAKE ${state.currentMakeIndex + 1}/${MAKE_QUEUE.length}: ${make.toUpperCase()}`
    );
    console.log(
      `>>> Starting page: ${startPage}`
    );
    console.log(
      "========================================"
    );

  
    let resumePage = startPage;
    let makeCompleted = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (runnerInterrupted) return;

      const result = await runCrawler([
        "make",
        make,
        String(resumePage),
      ]);

      const summary = readLastSummary();

      if (runnerInterrupted) return;

      if (
        result.code === 0 &&
        !result.signal &&
        summary?.status === "completed" &&
        ["old_date_cutoff", "empty_catalog"].includes(summary.stopReason)
      ) {
        makeCompleted = true;
        break;
      }

      // Save progress before attempting another run.
      resumePage = getSafeResumePage(
        make,
        Math.max(
          resumePage,
          summary?.lastCatalogPage || resumePage
        ),
        result.runStartedAt
      );

      state.makeStartPages[make] = resumePage;
      saveJson(AUTO_STATE_FILE, state);

      console.error(
        `Make ${make} failed. Attempt ${attempt}/${MAX_RETRIES}.`
      );
      console.log(`Saved resume page: ${resumePage}`);

      if (attempt < MAX_RETRIES) {
        const cooldown = getCooldown(attempt);

        console.log(
          `Cooling down for ${Math.round(cooldown / 1000)} seconds...`
        );

        await sleep(cooldown);
      }
    }

    if (!makeCompleted) {
      console.error(
        `Make ${make} could not complete after ${MAX_RETRIES} attempts.`
      );
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log(`>>> ${make.toUpperCase()} BACKFILL COMPLETE`);

    if (!state.completedMakes.includes(make)) {
      state.completedMakes.push(make);
    }

    state.currentMakeIndex++;
    saveJson(AUTO_STATE_FILE, state);
  }

  console.log("");
  console.log("========================================");
  console.log("ALL MAKE BACKFILLS COMPLETE");
  console.log("========================================");
}

main().catch((error) => {
  console.error("");
  console.error("Automatic runner failed:");
  console.error(error);
  process.exitCode = 1;
});
