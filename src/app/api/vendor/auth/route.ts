import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const CRED_FILE = path.join(process.cwd(), ".vendor_credentials.json");

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function cleanPhone(raw: string): string {
  let cleaned = raw.trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+256" + cleaned.slice(1);
  } else if (cleaned.startsWith("256")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+") && cleaned.length === 9) {
    cleaned = "+256" + cleaned;
  }
  return cleaned;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface StoredVendor {
  passwordHash: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  userId: string;
  phoneNumber: string;
  status?: string;
  isApproved?: boolean;
}

function loadRegistry(): Record<string, StoredVendor> {
  try {
    if (fs.existsSync(CRED_FILE)) {
      return JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveRegistry(reg: Record<string, StoredVendor>) {
  try {
    fs.writeFileSync(CRED_FILE, JSON.stringify(reg, null, 2), "utf-8");
  } catch (e) {
    console.error("[AUTH] Error saving credential registry:", e);
  }
}

function setSessionCookie(res: NextResponse, payload: any) {
  const jsonStr = JSON.stringify(payload);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };

  res.cookies.set("session_token", jsonStr, cookieOptions);
  res.cookies.set("staff_session", jsonStr, cookieOptions);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phoneNumber, password, currentPassword, newPassword, businessName, subCategory } = body;
    const registry = loadRegistry();

        // -------------------------------------------------------------
    // 1. SIGN IN
    // -------------------------------------------------------------
    if (action === "signin") {
      const rawInput = (phoneNumber || body.email || "").trim();
      if (!rawInput || !password) {
        return NextResponse.json(
          { success: false, message: "Phone number and password are required." },
          { status: 400 }
        );
      }

      const normalizedPhone = cleanPhone(rawInput);
      const candidateHash = hashSecret(password);
      const account = registry[normalizedPhone] || registry[rawInput];

      if (!account || account.passwordHash !== candidateHash) {
        // Special case fallback for Bourbon master admin
        if (
          (normalizedPhone === "+256772000004" || rawInput.includes("772000004")) &&
          (password === "admin123" || password === "1234")
        ) {
          const bourbonVendor = await db.query.vendors.findFirst({
            where: sql`${vendors.slug} = bourbon-pizza-wandegeya`,
          });

          const response = NextResponse.json({
            success: true,
            message: "Sign in successful.",
            vendor: {
              id: bourbonVendor?.id || "bourbon-uuid",
              name: "Bourbon Pizza Wandegeya",
              slug: "bourbon-pizza-wandegeya",
            },
          });

          setSessionCookie(response, {
            userId: bourbonVendor?.ownerId || "bourbon-user",
            vendorId: bourbonVendor?.id || "bourbon-uuid",
            vendorSlug: "bourbon-pizza-wandegeya",
            vendorName: "Bourbon Pizza Wandegeya",
            phoneNumber: normalizedPhone,
            role: "vendor_owner",
            staffName: "Bourbon Pizza Admin",
          });

          return response;
        }

        return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
      }

      // Check PostgreSQL specifically for THIS account slug
      let matchedVendor: any = null;
      try {
        matchedVendor = await db.query.vendors.findFirst({
          where: sql`${vendors.slug} = ${account.vendorSlug}`,
        });
      } catch {}

      const vendorStatus = matchedVendor?.status || account.status || "active";
      const isApproved = matchedVendor?.isApproved ?? account.isApproved ?? true;

      // Super Admin Gate Check
      if (vendorStatus === "pending_approval" || isApproved === false) {
        return NextResponse.json(
          {
            success: false,
            message: "Your merchant account is pending Super Admin approval. Please contact administration.",
          },
          { status: 403 }
        );
      }

      if (vendorStatus === "rejected" || vendorStatus === "suspended") {
        return NextResponse.json(
          {
            success: false,
            message: "Your merchant account has been suspended or rejected.",
          },
          { status: 403 }
        );
      }

      const activeVendorId = matchedVendor?.id || account.vendorId;
      const activeVendorSlug = matchedVendor?.slug || account.vendorSlug;
      const activeVendorName = matchedVendor?.name || account.vendorName;

      const response = NextResponse.json({
        success: true,
        message: "Sign in successful.",
        vendor: {
          id: activeVendorId,
          name: activeVendorName,
          slug: activeVendorSlug,
        },
      });

      setSessionCookie(response, {
        userId: account.userId || activeVendorId,
        vendorId: activeVendorId,
        vendorSlug: activeVendorSlug,
        vendorName: activeVendorName,
        phoneNumber: normalizedPhone,
        role: "vendor_owner",
        staffName: activeVendorName,
      });

      return response;
    }

    // -------------------------------------------------------------
    // 2. SIGN UP (NEW VENDOR)
    // -------------------------------------------------------------
    if (action === "signup") {
      const rawInput = (phoneNumber || body.email || "").trim();
      if (!businessName || !password || !rawInput) {
        return NextResponse.json(
          { success: false, message: "Store name, password, and contact phone are required." },
          { status: 400 }
        );
      }

      const normalizedPhone = cleanPhone(rawInput);
      const generatedSlug = slugify(businessName);
      const passHash = hashSecret(password);
      const newVendorId = crypto.randomUUID();

      // Step 2a: Ensure user exists in Postgres `users` table with role 'vendor_owner'
      let ownerUser: any = null;
      try {
        const existingUsers: any = await db
          .select()
          .from(users)
          .where(sql`${users.phone} = ${normalizedPhone}`)
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          ownerUser = existingUsers[0];
          // Upgrade or ensure role
          await db
            .update(users)
            .set({ role: 'vendor_owner', updatedAt: new Date() })
            .where(sql`${users.id} = ${ownerUser.id}`);
        } else {
          const newUserId = crypto.randomUUID();
          const [createdUser]: any = await db
            .insert(users)
            .values({
              id: newUserId,
              phone: normalizedPhone,
              role: 'vendor_owner',
              isActive: true,
              trustLevel: 50,
            } as any)
            .returning();
          ownerUser = createdUser;
        }
      } catch (userErr: any) {
        console.error("[AUTH] Error ensuring user for vendor:", userErr);
        return NextResponse.json(
          { success: false, message: `Failed to create merchant user record: ${userErr.message}` },
          { status: 500 }
        );
      }

      let createdVendor: any = null;
      try {
        const [inserted]: any = await db
          .insert(vendors)
          .values({
            id: newVendorId,
            ownerId: ownerUser.id,
            name: businessName.trim(),
            slug: generatedSlug,
            latitude: "0.3476",
            longitude: "32.5825",
            defaultSlotCapacity: 6,
            commissionBps: 1000,
            isVerified: false,
            payoutStatus: "active",
            serviceType: "dine_in_hybrid",
            enableTableOrdering: true,
            enableQrOrdering: true,
            sector: "food_beverage",
            subCategory: subCategory || "restaurant",
            isAcceptingOrders: false,
            isApproved: false,
            status: "pending_review",
          } as any)
          .returning();

        createdVendor = inserted;
      } catch (dbErr: any) {
        console.error("[AUTH] Postgres insert failed on vendors:", dbErr);
        return NextResponse.json(
          { success: false, message: `Failed to create vendor in database: ${dbErr.message}` },
          { status: 500 }
        );
      }

      // Keep disk registry synced for password verification fallback
      registry[normalizedPhone] = {
        passwordHash: passHash,
        vendorId: createdVendor.id,
        vendorName: createdVendor.name,
        vendorSlug: createdVendor.slug,
        userId: ownerUser.id,
        phoneNumber: normalizedPhone,
        status: "pending_review",
        isApproved: false,
      };
      saveRegistry(registry);

      return NextResponse.json({
        success: true,
        message: "Vendor registered successfully. Awaiting Super Admin approval.",
        vendor: {
          id: createdVendor.id,
          name: createdVendor.name,
          slug: createdVendor.slug,
          status: createdVendor.status,
          isApproved: createdVendor.isApproved,
        },
      });
    }

    // -------------------------------------------------------------
    // 3. CHANGE PASSWORD
    // -------------------------------------------------------------
    if (action === "change_password") {
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { success: false, message: "New password must be at least 4 characters long." },
          { status: 400 }
        );
      }

      const rawCookie = req.cookies.get("session_token")?.value || req.cookies.get("staff_session")?.value;
      let session: any = null;
      try {
        if (rawCookie) session = JSON.parse(decodeURIComponent(rawCookie));
      } catch {}

      const userPhone = session?.phoneNumber ? cleanPhone(session.phoneNumber) : null;
      if (!userPhone || !registry[userPhone]) {
        return NextResponse.json({ success: false, message: "Session vendor not found." }, { status: 404 });
      }

      if (currentPassword && registry[userPhone].passwordHash !== hashSecret(currentPassword)) {
        return NextResponse.json({ success: false, message: "Current password does not match." }, { status: 403 });
      }

      registry[userPhone].passwordHash = hashSecret(newPassword);
      saveRegistry(registry);

      return NextResponse.json({ success: true, message: "Password updated successfully." });
    }

    // -------------------------------------------------------------
    // 4. SIGN OUT
    // -------------------------------------------------------------
    if (action === "signout") {
      const response = NextResponse.json({ success: true, message: "Logged out." });
      response.cookies.delete("session_token");
      response.cookies.delete("staff_session");
      return response;
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
