import { neon } from '@neondatabase/serverless';

export interface DispatchPayload {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  dropoffCoordinates: {
    latitude: number;
    longitude: number;
  };
  pickupCoordinates: {
    latitude: number;
    longitude: number;
  };
  scheduledAt: string;
}

export interface Env {
  DISPATCH_QUEUE: Queue<DispatchPayload>;
  DATABASE_URL: string;
}

interface RiderCandidate {
  id: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
}

async function assignNearestRider(payload: DispatchPayload, databaseUrl: string) {
  let conn = databaseUrl || '';
  conn = conn.replace('-pooler', '');
  const sql = neon(conn);

  const { orderId, orderNumber, pickupCoordinates } = payload;

  // 1. Check order
  const orders = await sql`
    SELECT id, status 
    FROM orders 
    WHERE id::text = ${orderId} OR order_number = ${orderNumber}
    LIMIT 1;
  `;

  if (orders.length === 0) {
    throw new Error(`Order not found: ${orderNumber}`);
  }

  // 2. Query nearest available rider in Kampala using Haversine
  const availableRiders = (await sql`
    SELECT 
      id, 
      name, 
      phone, 
      vehicle_plate,
      current_latitude AS latitude, 
      current_longitude AS longitude,
      (6371 * acos(
        cos(radians(${pickupCoordinates.latitude})) * cos(radians(current_latitude)) *
        cos(radians(current_longitude) - radians(${pickupCoordinates.longitude})) +
        sin(radians(${pickupCoordinates.latitude})) * sin(radians(current_latitude))
      )) AS distance_km
    FROM riders
    WHERE is_active = true AND is_available = true
    ORDER BY distance_km ASC
    LIMIT 1;
  `) as any[];

  if (availableRiders.length === 0) {
    throw new Error(`No available riders found in Kampala zone`);
  }

  const assignedRider = availableRiders[0];

  // 3. Mark rider unavailable
  await sql`
    UPDATE riders 
    SET is_available = false, updated_at = NOW() 
    WHERE id = ${assignedRider.id};
  `;

  // 4. Update order to rider_assigned
  await sql`
    UPDATE orders 
    SET 
      status = 'rider_assigned'::order_status, 
      assigned_rider_id = ${assignedRider.id}
    WHERE id = ${orders[0].id};
  `;

  return {
    success: true,
    orderNumber,
    assignedRider: {
      id: assignedRider.id,
      name: assignedRider.name,
      phone: assignedRider.phone,
      distanceKm: Number(assignedRider.distance_km).toFixed(2),
    },
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Direct synchronous execution route for immediate verification
    if (req.method === 'POST' && url.pathname === '/dispatch/execute-now') {
      try {
        const body: any = await req.json();
        const payload: DispatchPayload = {
          orderId: body.orderId || '8a11a99a-4a40-4d58-9877-4fcbeb4e2321',
          orderNumber: body.orderNumber || 'KLA-035757',
          vendorId: body.vendorId || 'vendor_central_01',
          pickupCoordinates: body.pickupCoordinates || { latitude: 0.3136, longitude: 32.5811 },
          dropoffCoordinates: body.dropoffCoordinates || { latitude: 0.3476, longitude: 32.5825 },
          scheduledAt: new Date().toISOString(),
        };

        const result = await assignNearestRider(payload, env.DATABASE_URL);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message,
            stack: err.stack,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Queue enqueue route
    if (req.method === 'POST' && url.pathname === '/dispatch/enqueue') {
      try {
        const body: any = await req.json();
        const delaySeconds = body.delaySeconds ?? 300;

        const payload: DispatchPayload = {
          orderId: body.orderId,
          orderNumber: body.orderNumber,
          vendorId: body.vendorId || 'vendor_central_01',
          pickupCoordinates: body.pickupCoordinates || { latitude: 0.3136, longitude: 32.5811 },
          dropoffCoordinates: body.dropoffCoordinates || { latitude: 0.3476, longitude: 32.5825 },
          scheduledAt: new Date().toISOString(),
        };

        await env.DISPATCH_QUEUE.send(payload, { delaySeconds });

        return new Response(
          JSON.stringify({
            success: true,
            orderNumber: payload.orderNumber,
            delaySeconds,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ status: 'active', worker: 'klaretail-dispatch' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async queue(batch: MessageBatch<DispatchPayload>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await assignNearestRider(message.body, env.DATABASE_URL);
        message.ack();
      } catch (err: any) {
        console.error('[Queue Consumer Failure]:', err.message);
        message.retry({ delaySeconds: 15 });
      }
    }
  },
};
