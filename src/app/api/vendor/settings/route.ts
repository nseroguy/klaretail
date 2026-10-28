import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getActiveVendor } from "@/lib/vendor-session";

export async function GET(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, vendor });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const body = await req.json();
    const { name, serviceType, enableTableOrdering, enableQrOrdering, isAcceptingOrders } = body;

    const [updated] = await db
      .update(vendors)
      .set({
        name: name !== undefined ? name : vendor.name,
        serviceType: serviceType !== undefined ? serviceType : vendor.serviceType,
        enableTableOrdering: enableTableOrdering !== undefined ? enableTableOrdering : vendor.enableTableOrdering,
        enableQrOrdering: enableQrOrdering !== undefined ? enableQrOrdering : vendor.enableQrOrdering,
        isAcceptingOrders: isAcceptingOrders !== undefined ? isAcceptingOrders : vendor.isAcceptingOrders,
        updatedAt: new Date(),
      } as any)
      .where(sql`${vendors.id} = ${vendor.id}`)
      .returning();

    return NextResponse.json({ success: true, vendor: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
