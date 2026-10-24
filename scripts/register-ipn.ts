import 'dotenv/config';

async function registerLiveIpn() {
  const baseUrl = process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3/api';
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  const ipnUrl = process.env.PESAPAL_IPN_URL || 'https://retail.techaus.online/api/webhooks/pesapal';

  console.log(`Connecting to Pesapal Live at: ${baseUrl}`);
  console.log(`Registering webhook target: ${ipnUrl}\n`);

  if (!key || !secret) {
    throw new Error('PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET is missing from .env');
  }

  // 1. Authenticate with Pesapal Live
  const authRes = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: key,
      consumer_secret: secret,
    }),
  });

  const authText = await authRes.text();
  if (!authRes.ok) {
    throw new Error(`Authentication failed [HTTP ${authRes.status}]: ${authText}`);
  }

  let authData: any;
  try {
    authData = JSON.parse(authText);
  } catch {
    throw new Error(`Invalid JSON response from Pesapal Auth: ${authText}`);
  }

  if (!authData.token) {
    throw new Error(`Token missing in authentication response: ${authText}`);
  }

  console.log('🔑 Authenticated successfully with Pesapal Live API.');

  // 2. Register IPN Webhook
  const ipnRes = await fetch(`${baseUrl}/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authData.token}`,
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: 'POST',
    }),
  });

  const ipnText = await ipnRes.text();
  if (!ipnRes.ok) {
    throw new Error(`IPN registration failed [HTTP ${ipnRes.status}]: ${ipnText}`);
  }

  const ipnData = JSON.parse(ipnText);
  console.log('📡 IPN Registration Response:', ipnData);

  if (ipnData.ipn_id) {
    console.log(`\n========================================`);
    console.log(`✅ LIVE PESAPAL_IPN_ID successfully created!`);
    console.log(`👉 Add this to your .env:`);
    console.log(`PESAPAL_IPN_ID="${ipnData.ipn_id}"`);
    console.log(`========================================\n`);
  }
}

registerLiveIpn().catch((err) => {
  console.error('\n❌ Live registration error:', err);
  process.exit(1);
});
