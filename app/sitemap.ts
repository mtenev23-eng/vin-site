import { MetadataRoute } from "next";
import { supabase } from "../utils/supabase/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: cars, error } = await supabase
    .from("cars")
    .select("vin");

  if (error) {
    console.error("Sitemap Supabase error:", error);

    return [
      {
        url: "https://salvagevinhistory.com",
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1,
      },
    ];
  }

  const vinPages =
    cars?.map((car) => ({
      url: `https://salvagevinhistory.com/vin/${car.vin}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })) || [];

  return [
    {
      url: "https://salvagevinhistory.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...vinPages,
  ];
}