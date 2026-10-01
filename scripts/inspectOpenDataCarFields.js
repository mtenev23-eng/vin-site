const URL =
  "https://opendatacar.com/en/auction/kia/sportage/2024/2024-kia-sportage-kndpvcdg2r7166372";

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`HTTP ${response.status}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

function showMatches(html, term) {
  const lowerHtml = html.toLowerCase();
  const lowerTerm = term.toLowerCase();

  let index = 0;
  let count = 0;

  while (true) {
    index = lowerHtml.indexOf(lowerTerm, index);

    if (index === -1) break;

    count++;

    console.log("");
    console.log(`===== ${term} MATCH ${count} =====`);

    const start = Math.max(0, index - 250);
    const end = Math.min(html.length, index + 500);

    console.log(
      html
        .slice(start, end)
        .replace(/\s+/g, " ")
    );

    index += lowerTerm.length;

    if (count >= 3) break;
  }

  if (count === 0) {
    console.log("");
    console.log(`===== ${term}: NOT FOUND =====`);
  }
}

async function main() {
  try {
    const html = await fetchPage(URL);

    console.log(`HTML size: ${html.length}`);

    const terms = [
  "Vehicle Specs",
  "Body Style",
  "All Wheel Drive",
  "Lot Information",
  "Documents & Export",
  "Seller Type",
  "Start Code",
  "Market Value in USA",
  "Auction Repair Estimate",
];

    for (const term of terms) {
      showMatches(html, term);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();