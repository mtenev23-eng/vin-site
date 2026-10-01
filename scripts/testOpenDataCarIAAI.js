const URL =
  "https://opendatacar.com/en/auction/toyota/venza/2022/2022-toyota-venza-jteaaaah3nj096229";

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function extractImageUrls(html) {
  const iaaiImages = [];

  const galleryMatch = html.match(
    /window\.lotGalleryImages\s*=\s*(\[[\s\S]*?\]);/i
  );

  if (galleryMatch) {
    try {
      const gallery = JSON.parse(galleryMatch[1]);

      if (Array.isArray(gallery)) {
        for (const url of gallery) {
          if (
            typeof url === "string" &&
            url.includes("vis.iaai.com/deepzoom")
          ) {
            iaaiImages.push(decodeHtml(url));
          }
        }
      }
    } catch (error) {
      console.log("Gallery parse error:", error.message);
    }
  }

  return [...new Set(iaaiImages)].slice(0, 20);
}

async function validateImageUrls(urls) {
  const validUrls = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
        },
      });

      const contentType =
        response.headers.get("content-type") || "";

      const valid =
        response.ok &&
        contentType.toLowerCase().startsWith("image/");

      console.log(
        `${valid ? "VALID" : "INVALID"} | HTTP ${response.status} | ${contentType}`
      );

      if (valid) {
        validUrls.push(url);
      }

      if (response.body) {
        await response.body.cancel();
      }
    } catch (error) {
      console.log(`FAILED | ${error.message}`);
    }
  }

  return validUrls;
}

async function main() {
  console.log(`Fetching IAAI test vehicle...`);
  console.log(URL);
  console.log("");

  const response = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`Detail page HTTP: ${response.status}`);

  if (!response.ok) {
    return;
  }

  const html = await response.text();

  const images = extractImageUrls(html);

  console.log(`Extracted IAAI images: ${images.length}`);
  console.log("");

  images.forEach((url, index) => {
    console.log(`${index + 1}. ${url}`);
  });

  console.log("");
  console.log("Validating images...");
  console.log("");

  const validImages =
    await validateImageUrls(images);

  console.log("");
  console.log("==============================");
  console.log(`Extracted: ${images.length}`);
  console.log(`Valid: ${validImages.length}`);
  console.log("==============================");
}

main().catch(console.error);