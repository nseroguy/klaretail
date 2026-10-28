import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { orderId, status } = await req.json();

        // Normalize incoming KDS bump commands to valid order_status enum values
    let targetStatus = String(status).trim().toLowerCase();
    const statusMap: Record<string, string> = {
      "ready": "delivered",
      "ready_for_pickup": "delivered",
      "done": "delivered",
      "bump": "delivered",
      "served": "delivered",
      "completed": "delivered",
      "finish": "delivered",
      "finished": "delivered",
      "dispatch": "dispatched",
      "prep": "preparing",
      "prepare": "preparing"
    };

    if (statusMap[targetStatus]) {
      targetStatus = statusMap[targetStatus];
    }


    if (!orderId || !status) {
      return NextResponse.json({ success: false, message: "Missing orderId or status" }, { status: 400 });
    }

    await db
      .update(orders)
      .set({
        status: targetStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[KDS_UPDATE_STATUS_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
