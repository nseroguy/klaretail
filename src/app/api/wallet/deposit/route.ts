import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function getPesapalBaseUrl(): string {
  let url = (process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3').trim();
  if (url.endsWith('/api')) {
    url = url.slice(0, -4);
  }
  return url;
}

async function getPesapalAuthToken(): Promise<{ token: string | null; error?: string }> {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim() || '';
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim() || '';
  const baseUrl = getPesapalBaseUrl();

  if (!consumerKey || !consumerSecret) {
    return { token: null, error: 'Pesapal Consumer Key or Secret missing in .env.' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return { token: null, error: `Pesapal Auth non-JSON: ${text.slice(0, 100)}` };
    }

    const data = await res.json();
    return { token: data.token || null };
  } catch (err: any) {
    return { token: null, error: err.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawCookie = 
      req.cookies.get('session_token')?.value || 
      req.cookies.get('staff_session')?.value || 
      req.cookies.get('klaretail_session')?.value ||
      req.cookies.get('vendor_session')?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session format' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, paymentMethod } = body;
    const depositAmount = Number(amount);

    if (!depositAmount || depositAmount < 500) {
      return NextResponse.json({ success: false, message: 'Minimum deposit is UGX 500.' }, { status: 400 });
    }

    const sessionPhone = session.phone || '+256772000003';
    const cleanPhone = sessionPhone.startsWith('+') ? sessionPhone : `+${sessionPhone}`;
    const merchantRef = `DEP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const baseUrl = getPesapalBaseUrl();
    const ipnId = process.env.PESAPAL_IPN_ID?.trim() || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://retail.techaus.online';
    const callbackUrl = `${appUrl}/vendor/wallet?depositRef=${merchantRef}`;

    const { token, error: authError } = await getPesapalAuthToken();
    if (!token) {
      return NextResponse.json({
        success: false,
        message: `Pesapal Authentication Failed: ${authError}`,
      }, { status: 400 });
    }

    const orderPayload = {
      id: merchantRef,
      currency: 'UGX',
      amount: depositAmount,
      description: `Wallet Float Topup (${paymentMethod || 'MOBILE_MONEY'})`,
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        phone_number: cleanPhone,
        email_address: session.email || `${cleanPhone.replace(/[^0-9]/g, '')}@retail.techaus.online`,
        country_code: 'UG',
        first_name: 'Merchant',
        last_name: session.vendorSlug || 'Store',
      },
    };

    // Use official Pesapal v3 endpoint: SubmitOrderRequest
    const pesapalRes = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const resContentType = pesapalRes.headers.get('content-type') || '';
    if (!resContentType.includes('application/json')) {
      const errText = await pesapalRes.text();
      return NextResponse.json({
        success: false,
        message: `Pesapal gateway non-JSON error (${pesapalRes.status}): ${errText.slice(0, 120)}`,
      }, { status: 502 });
    }

    const pesapalData = await pesapalRes.json();

    if (!pesapalData.redirect_url) {
      const errMsg = pesapalData.message || pesapalData.error?.message || JSON.stringify(pesapalData);
      return NextResponse.json({
        success: false,
        message: `Pesapal Order Rejected: ${errMsg}`,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Redirecting to Pesapal Payment Gateway...',
      merchantRef,
      redirectUrl: pesapalData.redirect_url,
      orderTrackingId: pesapalData.order_tracking_id,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
