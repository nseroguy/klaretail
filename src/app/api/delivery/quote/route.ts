import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeSectorDeliveryFee } from "@/lib/deliveryPricing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, customerLat, customerLng, items, channel } = body;

    if (!vendorId || customerLat === undefined || customerLng === undefined) {
      return NextResponse.json(
        { success: false, error: "vendorId, customerLat, and customerLng are required" },
        { status: 400 }
      );
    }

    const [vendor] = await db
      .select({
        id: vendors.id,
        sector: vendors.sector,
        subCategory: vendors.subCategory,
        latitude: vendors.latitude,
        longitude: vendors.longitude,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 }
      );
    }

    const quote = computeSectorDeliveryFee({
      vendorSector: vendor.sector ?? undefined,
      vendorSubCategory: vendor.subCategory ?? undefined,
      channel: channel || "retail",
      vendorLat: Number(vendor.latitude) || 0.3136,
      vendorLng: Number(vendor.longitude) || 32.5811,
      customerLat: Number(customerLat),
      customerLng: Number(customerLng),
      items: items || [],
    });

    return NextResponse.json({ success: true, ...quote });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate quote" },
      { status: 500 }
    );
  }
}
