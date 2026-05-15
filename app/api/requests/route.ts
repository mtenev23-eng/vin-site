import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "requests.json");

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { vin, name, contact, requestType, message } = body;

    if (!vin || !name || !contact || !requestType || !message) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    const newRequest = {
      id: Date.now(),
      vin,
      name,
      contact,
      requestType,
      message,
      status: "new",
      submittedAt: new Date().toISOString(),
    };

    const existingFile = await fs.readFile(filePath, "utf-8");
    const existingRequests = JSON.parse(existingFile);

    existingRequests.push(newRequest);

    await fs.writeFile(filePath, JSON.stringify(existingRequests, null, 2));

    return NextResponse.json({
      success: true,
      message: "Request submitted successfully.",
    });
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}