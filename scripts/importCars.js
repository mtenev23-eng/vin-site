const fs = require("fs");
const path = require("path");

const csvPath = path.join(process.cwd(), "data", "import-cars.csv");
const carsJsonPath = path.join(process.cwd(), "data", "cars.json");

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

const csv = fs.readFileSync(csvPath, "utf-8");
const lines = csv.trim().split("\n");

const headers = parseCsvLine(lines[0]).map((header) => header.trim());

const importedCars = lines.slice(1).map((line) => {
  const values = parseCsvLine(line);
  const car = {};

  headers.forEach((header, index) => {
  car[header] = values[index] ? values[index].trim() : "";
});

  return {
    vin: car.vin.toUpperCase(),
    year: Number(car.year),
    make: car.make,
    model: car.model,
    trim: car.trim,
    mileage: Number(car.mileage),
    finalBid: Number(car.finalBid),
    auctionDate: car.auctionDate,
    location: car.location,
    primaryDamage: car.primaryDamage,
    secondaryDamage: car.secondaryDamage,
    color: car.color,
imageUrls: car.imageUrls
  ? car.imageUrls.split("|").map((url) => url.trim())
  : [],
  };
});

const existingCars = JSON.parse(fs.readFileSync(carsJsonPath, "utf-8"));

const carsByVin = new Map();

for (const car of existingCars) {
  carsByVin.set(car.vin.toUpperCase(), car);
}

for (const car of importedCars) {
  carsByVin.set(car.vin.toUpperCase(), car);
}

const mergedCars = Array.from(carsByVin.values());

fs.writeFileSync(carsJsonPath, JSON.stringify(mergedCars, null, 2));

console.log(`Imported ${importedCars.length} cars.`);
console.log(`Total cars in database: ${mergedCars.length}`);