import fs from "fs/promises";
import path from "path";
import { MetadataRoute } from "next";

const filePath = path.join(process.cwd(), "data", "cars.json");

type Car = {
  vin: string;
};

async function getCars(): Promise<Car[]> {
  const file = await fs.readFile(filePath, "utf-8");
  return JSON.parse(file);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cars = await getCars();

  const baseUrl = "http://localhost:3000";

  const vinPages = cars.map((car) => ({
    url: `${baseUrl}/vin/${car.vin}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...vinPages,
  ];
}