'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CreditCard, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  History,
  ShieldCheck,
  X,
  ExternalLink,
  Check
} from 'lucide-react';

interface WalletState {
  balance: number;
  heldFloat: number;
  phone?: string;
}

interface LedgerEntry {
  id: string;
  entryType: string;
  amount: number;
  balanceAfter: number;
  metadata: any;
  createdAt: string;
}

function WalletContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletState>({ balance: 0, heldFloat: 0 });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'CARD'>('MOMO');
  const [amount, setAmount] = useState('50000');
  const [destinationPhone, setDestinationPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal & Polling state
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [activeMerchantRef, setActiveMerchantRef] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallet/summary');
      const data = await res.json();
      if (data.success && data.wallet) {
        setWallet(data.wallet);
        setLedger(data.ledger || []);
        if (data.wallet.phone && !destinationPhone) {
          setDestinationPhone(data.wallet.phone);
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to retrieve wallet information.' });
    } finally {
      setLoading(false);
    }
  };

  // Poll server while Pesapal modal is open to auto-close upon USSD or Card completion
  useEffect(() => {
    if (checkoutUrl && activeMerchantRef) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/wallet/summary');
          const data = await res.json();
          if (data.success && data.ledger) {
            const confirmed = data.ledger.find(
              (item: any) => item.metadata?.merchantRef === activeMerchantRef
            );
            if (confirmed) {
              setPaymentSuccess(true);
              clearInterval(pollTimerRef.current!);
              setTimeout(() => {
                setCheckoutUrl(null);
                setPaymentSuccess(false);
                fetchWallet();
                setFeedback({
                  type: 'success',
                  message: `Deposit of UGX ${Number(amount).toLocaleString()} confirmed and credited to float!`,
                });
              }, 1200);
            }
          }
        } catch {
          // Keep polling silently
        }
      }, 4000);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [checkoutUrl, activeMerchantRef, amount]);

  // Handle postMessage events sent from Pesapal iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('pesapal.com')) return;
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload?.status === 'COMPLETED' || payload?.payment_status === 'COMPLETED') {
          setPaymentSuccess(true);
          setTimeout(() => {
            setCheckoutUrl(null);
            fetchWallet();
          }, 1000);
        }
      } catch {
        // Non-JSON message from iframe
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check URL query parameters for return settlement
  useEffect(() => {
    const depositRef = searchParams.get('depositRef') || searchParams.get('OrderMerchantReference');
    const trackingId = searchParams.get('OrderTrackingId');

    if (depositRef && trackingId) {
      const verifySettlement = async () => {
        try {
          const res = await fetch('/api/webhooks/pesapal-deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merchantReference: depositRef,
              trackingId,
              status: 'COMPLETED',
            }),
          });
          const resData = await res.json();
          if (res.ok && resData.status === 200) {
            setFeedback({
              type: 'success',
              message: 'Deposit verified successfully and float credited!',
            });
            router.replace('/vendor/wallet');
          }
        } catch (e: any) {
          console.error('Error verifying return:', e);
        } finally {
          fetchWallet();
        }
      };
      verifySettlement();
    } else {
      fetchWallet();
    }
  }, [searchParams]);

  const handleDeposit = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          paymentMethod: paymentMethod === 'MOMO' ? 'MOBILE_MONEY' : 'CARD',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Payment gateway returned non-JSON response.');
      }

      const data = await res.json();
      if (data.success && data.redirectUrl) {
        setActiveMerchantRef(data.merchantRef);
        setActiveTrackingId(data.orderTrackingId || null);
        setCheckoutUrl(data.redirectUrl);
      } else {
        setFeedback({ type: 'error', message: data.message || 'Deposit initiation failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error connecting to payment gateway.' });
    } finally {
      setSubmitting(false);
    }
  };

  const closeCheckoutPopup = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setCheckoutUrl(null);
    setActiveTrackingId(null);
    setActiveMerchantRef(null);
    fetchWallet();
  };

  const handleWithdraw = async () => {
    if (!destinationPhone.trim()) {
      setFeedback({ type: 'error', message: 'Destination phone number is required.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          destinationPhone: destinationPhone.trim(),
          channel: 'MTN_MOMO',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `Withdrawal request for UGX ${Number(amount).toLocaleString()} submitted.`,
        });
        fetchWallet();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Withdrawal failed.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error processing payout.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 text-neutral-900 relative">
      
      {/* Exact Styled Pesapal Modal Dialog */}
      {checkoutUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col h-[92vh] max-h-[800px]">
            
            {/* Header matching screenshot */}
            <div className="bg-[#003366] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white text-[#003366] font-extrabold flex items-center justify-center rounded-md text-xs">
                  P
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Pesapal v3 Payment Gateway</h3>
                  <div className="text-[11px] opacity-80 flex items-center gap-1.5 font-mono">
                    <span>{activeMerchantRef || 'Float Deposit'}</span>
                    <span>•</span>
                    <span>UGX {Number(amount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-medium flex items-center gap-1"
                >
                  <span>New Window</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={closeCheckoutPopup}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe Container */}
            <div className="flex-1 w-full bg-white relative">
              {paymentSuccess ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <h4 className="text-lg font-bold text-stone-900">Payment Confirmed!</h4>
                  <p className="text-sm text-stone-500">Crediting float to your store treasury...</p>
                </div>
              ) : (
                <iframe
                  src={checkoutUrl}
                  title="Pesapal Checkout Modal"
                  className="w-full h-full border-0 bg-white"
                  allow="payment *; publickey-credentials-get *"
                />
              )}
            </div>

            {/* Footer matching screenshot */}
            <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Authorized Bank of Uganda Payment Operator</span>
              </div>
              <button
                onClick={closeCheckoutPopup}
                className="px-4 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 transition text-xs font-semibold text-stone-700 shadow-sm"
              >
                I Have Completed Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Wallet className="w-4 h-4" /> Multi-Tender Digital Ledger
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Store Wallet & Treasury</h1>
            <p className="text-sm text-stone-500">Deposit float via Pesapal (Mobile Money/Cards) or withdraw store earnings.</p>
          </div>
          <button
            onClick={fetchWallet}
            className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition text-stone-600 flex items-center gap-2 text-xs font-semibold self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Available Float</span>
            <div className="text-3xl font-extrabold text-stone-900 font-mono">
              UGX {wallet.balance.toLocaleString()}
            </div>
            <p className="text-xs text-stone-400">Usable immediately for inventory procurement and daily operations.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" /> Escrow Held Float
            </div>
            <div className="text-3xl font-extrabold text-amber-700 font-mono">
              UGX {wallet.heldFloat.toLocaleString()}
            </div>
            <p className="text-xs text-stone-400">Locked in active B2B purchase orders or outgoing disbursements.</p>
          </div>
        </div>

        {/* Action Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setActionType('deposit')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  actionType === 'deposit' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                Deposit Float
              </button>
              <button
                onClick={() => setActionType('withdraw')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  actionType === 'withdraw' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-stone-700" />
                Withdraw Funds
              </button>
            </div>

            {actionType === 'deposit' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Payment Gateway Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('MOMO')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
                        paymentMethod === 'MOMO'
                          ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold">Mobile Money</div>
                        <div className="text-[10px] text-stone-500">MTN / Airtel</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
                        paymentMethod === 'CARD'
                          ? 'border-emerald-600 bg-emerald-50/40 text-emerald-900'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-xs font-bold">Bank Card</div>
                        <div className="text-[10px] text-stone-500">Visa / Mastercard</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Deposit Amount (UGX)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2 mt-2">
                    {['20000', '50000', '100000', '250000'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className="text-[11px] font-mono px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700"
                      >
                        +{Number(preset) / 1000}k
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-50 p-3 rounded-xl flex items-start gap-2 text-[11px] text-stone-500 border border-stone-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Processed securely via Pesapal API v3. Float is credited upon payment confirmation.</span>
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={submitting || Number(amount) < 500}
                  className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Proceed to Checkout'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Payout Phone Number</label>
                  <input
                    type="text"
                    value={destinationPhone}
                    onChange={(e) => setDestinationPhone(e.target.value)}
                    placeholder="+256782998877"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1.5 block">Withdrawal Amount (UGX)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">
                    Max Available: UGX {wallet.balance.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={submitting || Number(amount) > wallet.balance || Number(amount) <= 0}
                  className="w-full bg-stone-900 text-white font-semibold py-3 rounded-xl hover:bg-stone-800 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Request Mobile Money Payout'}
                </button>
              </div>
            )}
          </div>

          {/* Ledger Statement */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-semibold text-stone-900 border-b border-stone-100 pb-3">
              <History className="w-4 h-4 text-stone-500" />
              <h3>Ledger Statement & Activity Audit</h3>
            </div>

            {ledger.length === 0 ? (
              <p className="text-xs text-stone-400 py-10 text-center">No ledger entries recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 max-h-[460px] overflow-y-auto pr-1">
                {ledger.map((entry) => {
                  const isCredit = entry.amount > 0;
                  return (
                    <div key={entry.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-stone-900 flex items-center gap-2">
                          <span>{entry.entryType}</span>
                          {entry.metadata?.merchantRef && (
                            <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                              {entry.metadata.merchantRef}
                            </span>
                          )}
                          {entry.metadata?.poNumber && (
                            <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                              {entry.metadata.poNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold ${isCredit ? 'text-emerald-600' : 'text-stone-900'}`}>
                          {isCredit ? '+' : ''}{entry.amount.toLocaleString()} UGX
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          Bal: {entry.balanceAfter.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function VendorWalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 p-8 flex items-center justify-center text-stone-500">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    }>
      <WalletContent />
    </Suspense>
  );
}
