import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    if (!["approve", "reject", "suspend"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'approve', 'reject', or 'suspend'." },
        { status: 400 }
      );
    }

    const isApprove = action === "approve";
    const nextStatus = isApprove ? "active" : action === "reject" ? "rejected" : "suspended";

    const updated = await db
      .update(vendors)
      .set({
        status: nextStatus,
        isApproved: isApprove,
        isAcceptingOrders: isApprove,
      })
      .where(eq(vendors.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json(
        { success: false, error: "Vendor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Vendor ${nextStatus} successfully`,
      vendor: updated[0],
    });
  } catch (error: any) {
    console.error("Vendor approval error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update vendor status" },
      { status: 500 }
    );
  }
}
