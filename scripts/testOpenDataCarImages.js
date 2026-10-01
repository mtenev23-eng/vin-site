const URL =
  "https://opendatacar.com/en/auction/bmw/x7/2025/2025-bmw-x7-5ux23em08s9x26256";

async function main() {
  const response = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log("DETAIL HTTP:", response.status);

  const html = await response.text();

  const thumbnails = [
    ...html.matchAll(
      /https?:\/\/[^"'\\\s<>]+_thb\.jpg/gi
    ),
  ].map((match) => match[0]);

  const highResUrls = [
    ...new Set(
      thumbnails.map((url) =>
        url.replace("_thb.jpg", "_hrs.jpg")
      )
    ),
  ];

  console.log(
    "High-res candidates:",
    highResUrls.length
  );

  const started = Date.now();

  const results = await Promise.all(
    highResUrls.map(async (url) => {
      try {
        const imageResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36",
          },
        });

        const contentType =
          imageResponse.headers.get(
            "content-type"
          ) || "";

        const valid =
          imageResponse.ok &&
          contentType
            .toLowerCase()
            .startsWith("image/");

        if (imageResponse.body) {
          await imageResponse.body.cancel();
        }

        console.log(
          `${valid ? "OK" : "BAD"} | ${
            imageResponse.status
          } | ${url}`
        );

        return valid ? url : null;
      } catch (error) {
        console.log(
          `ERROR | ${url} | ${error.message}`
        );

        return null;
      }
    })
  );

  const validUrls =
    results.filter(Boolean);

  console.log("\n======================");
  console.log(
    "Candidates:",
    highResUrls.length
  );
  console.log(
    "Valid:",
    validUrls.length
  );
  console.log(
    "Rejected:",
    highResUrls.length -
      validUrls.length
  );
  console.log(
    "Time:",
    `${Date.now() - started} ms`
  );
  console.log("======================");
}

main().catch(console.error);