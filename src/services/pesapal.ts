// src/services/pesapal.ts

interface PesapalAuthConfig {
  consumerKey: string;
  consumerSecret: string;
  baseUrl: string; // https://pay.pesapal.com/v3/api or sandbox equivalent
  ipnNotificationUrl: string;
  callbackUrl: string;
}

interface AuthTokenResponse {
  token: string;
  expiryDate: string;
  error?: unknown;
  status: string;
}

interface RegisterIpnResponse {
  url: string;
  created_date: string;
  ipn_id: string;
  error?: unknown;
  status: string;
}

export interface SubmitOrderParams {
  orderId: string;
  orderNumber: string;
  amount: number; // In UGX (Integer)
  currency?: string; // Default 'UGX'
  description: string;
  customer: {
    email?: string;
    phoneNumber: string; // e.g. +256770000000
    firstName: string;
    lastName?: string;
  };
}

export interface SubmitOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: unknown;
  status: string;
}

export interface TransactionStatusResponse {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: 'Completed' | 'Failed' | 'Reversed' | 'Invalid';
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number; // 1 = Completed, 2 = Failed, 3 = Reversed
  merchant_reference: string;
  account_number: string;
  payment_status_code: string;
  currency: string;
  error?: unknown;
  status: string;
}

export class PesapalService {
  private config: PesapalAuthConfig;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private cachedIpnId: string | null = null;

  constructor(config?: Partial<PesapalAuthConfig>) {
    this.config = {
      consumerKey: config?.consumerKey || process.env.PESAPAL_CONSUMER_KEY || '',
      consumerSecret: config?.consumerSecret || process.env.PESAPAL_CONSUMER_SECRET || '',
      baseUrl: config?.baseUrl || process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3/api',
      ipnNotificationUrl: config?.ipnNotificationUrl || process.env.PESAPAL_IPN_URL || '',
      callbackUrl: config?.callbackUrl || process.env.PESAPAL_CALLBACK_URL || '',
    };

    if (!this.config.consumerKey || !this.config.consumerSecret) {
      throw new Error('Pesapal credentials missing in configuration or environment variables.');
    }
  }

  /**
   * Generates or returns an active Bearer Token.
   * Caches token in-memory and refreshes 5 minutes before expiration.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    const safetyBufferMs = 5 * 60 * 1000;

    if (this.cachedToken && this.tokenExpiresAt > now + safetyBufferMs) {
      return this.cachedToken;
    }

    const response = await fetch(`${this.config.baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        consumer_key: this.config.consumerKey,
        consumer_secret: this.config.consumerSecret,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pesapal authentication failed [${response.status}]: ${errText}`);
    }

    const data: AuthTokenResponse = await response.json();
    this.cachedToken = data.token;
    this.tokenExpiresAt = new Date(data.expiryDate).getTime();

    return this.cachedToken;
  }

  /**
   * Registers or resolves the IPN notification URL to retrieve the required IPN ID.
   */
  public async getOrRegisterIpnId(): Promise<string> {
    if (this.cachedIpnId) return this.cachedIpnId;
    if (process.env.PESAPAL_IPN_ID) {
      this.cachedIpnId = process.env.PESAPAL_IPN_ID;
      return this.cachedIpnId;
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: this.config.ipnNotificationUrl,
        ipn_notification_type: 'POST',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pesapal IPN registration failed [${response.status}]: ${errText}`);
    }

    const data: RegisterIpnResponse = await response.json();
    this.cachedIpnId = data.ipn_id;
    return this.cachedIpnId;
  }

  /**
   * Submits a customer order to Pesapal v3 to generate the payment tracking ref & redirect URL.
   */
  public async submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResponse> {
    const token = await this.getAccessToken();
    const ipnId = await this.getOrRegisterIpnId();

    const nameParts = params.customer.firstName.trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = params.customer.lastName || nameParts.slice(1).join(' ') || 'User';

    const payload = {
      id: params.orderNumber, // Merchant reference
      currency: params.currency || 'UGX',
      amount: params.amount,
      description: params.description,
      callback_url: this.config.callbackUrl,
      notification_id: ipnId,
      billing_address: {
        phone_number: params.customer.phoneNumber,
        email_address: params.customer.email || 'customer@marketplace.ug',
        first_name: firstName,
        last_name: lastName,
        country_code: 'UG',
      },
    };

    const response = await fetch(`${this.config.baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pesapal SubmitOrderRequest failed [${response.status}]: ${errText}`);
    }

    return (await response.json()) as SubmitOrderResponse;
  }

  /**
   * Polls Pesapal for the authoritative payment state of an order tracking ID.
   */
  public async getTransactionStatus(orderTrackingId: string): Promise<TransactionStatusResponse> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.config.baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pesapal GetTransactionStatus failed [${response.status}]: ${errText}`);
    }

    return (await response.json()) as TransactionStatusResponse;
  }
}

export const pesapal = new PesapalService();