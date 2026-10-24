const vins = [
  "WBX63GM04T5698983",
  "WBA23LA09TFW60617",
  "3MW89CW09T8G55489",
  "5UX53GP08S9042568",
  "1G1FB1RX0P0134942",
  "2GNAXSEV4L6270710",
  "1HGCY2F77TA039349",
  "19XFL1H83PE009505",
  "5NPD74LF1LH505198",
  "SALYJ2EUXMA317400"
];

async function main() {
  for (const vin of vins) {
    try {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const vehicle = data.Results?.[0];

      console.log({
        vin,
        year: vehicle?.ModelYear,
        make: vehicle?.Make,
        model: vehicle?.Model,
        errorCode: vehicle?.ErrorCode
      });
    } catch (error) {
      console.error(vin, error.message);
    }
  }
}

main();
