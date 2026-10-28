export function normalizeUgandanPhone(phone: string): string | null {
  if (!phone) return null;
  
  let cleaned = phone.trim().replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '+256' + cleaned.slice(1);
  } else if (cleaned.startsWith('256')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+256')) {
    return null;
  }

  const ugandaRegex = /^\+256(7[0-9]|20|39|41)\d{7}$/;
  if (!ugandaRegex.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export async function dispatchOtpNotification(phone: string, code: string): Promise<void> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  const senderId = process.env.AT_SENDER_ID;

  if (username && apiKey && apiKey !== 'your_africastalking_api_key_here') {
    try {
      const endpoint = username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const bodyParams = new URLSearchParams();
      bodyParams.append('username', username);
      bodyParams.append('to', phone);
      bodyParams.append('message', `Your KlaRetail code is ${code}. Valid for 10 minutes. Do not share this code.`);
      if (senderId) bodyParams.append('from', senderId);

      const atRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apiKey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
      });

      const data = await atRes.json().catch(() => null);
      console.log(`[AT SMS SENT] Status:`, JSON.stringify(data));
      return;
    } catch (err: any) {
      console.error(`[AT SMS FAILURE]`, err.message || err);
    }
  }

  // Local/Dev Fallback Console Output
  console.log(`\n======================================================`);
  console.log(`[CUSTOMER AUTH GATEWAY (DEV)]`);
  console.log(`Destination: ${phone}`);
  console.log(`Security Code: ${code}`);
  console.log(`Message: Your KlaRetail code is ${code}. Valid for 10 minutes.`);
  console.log(`======================================================\n`);
}
