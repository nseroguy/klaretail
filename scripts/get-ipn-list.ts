import 'dotenv/config';

async function getIpnList() {
  const baseUrl = process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3/api';
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;

  if (!key || !secret) {
    throw new Error('PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET is missing from .env');
  }

  // 1. Get Live Token
  const authRes = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  const authData = await authRes.json();
  if (!authData.token) throw new Error(`Auth failed: ${JSON.stringify(authData)}`);

  // 2. Fetch all registered IPNs for this account
  const listRes = await fetch(`${baseUrl}/URLSetup/GetIPNList`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authData.token}`,
    },
  });

  const list = await listRes.json();
  console.log('📋 Registered IPNs on your account:\n', JSON.stringify(list, null, 2));

  const match = Array.isArray(list) 
    ? list.find((item: any) => item.url?.includes('retail.techaus.online'))
    : null;

  if (match) {
    console.log(`\n========================================`);
    console.log(`🎯 Matched IPN for retail.techaus.online!`);
    console.log(`👉 Add this to your .env:`);
    console.log(`PESAPAL_IPN_ID="${match.ipn_id}"`);
    console.log(`========================================\n`);
  }
}

getIpnList().catch(console.error);
