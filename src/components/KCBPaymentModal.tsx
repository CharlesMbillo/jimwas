import { useState, useEffect } from 'react';
import { X, Smartphone, Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from './Toast';
import { KCBClient } from '../lib/modules/payments/kcb/client';
import {
  saveKCBPaymentTransaction,
  updateKCBTransactionStatus,
  getKCBPaymentTransaction,
  markKCBTransactionComplete,
} from '../lib/db';
import type { KCBPaymentTransaction } from '../lib/db';

interface KCBPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (transaction: KCBPaymentTransaction) => void;
  amount: number; // Amount in KES
  invoiceNumber: string;
  description?: string;
}

type PaymentStep = 'phone_input' | 'processing' | 'polling' | 'success' | 'failed';

export function KCBPaymentModal({
  isOpen,
  onClose,
  onPaymentComplete,
  amount,
  invoiceNumber,
  description,
}: KCBPaymentModalProps) {
  const toast = useToast();

  // State management
  const [step, setStep] = useState<PaymentStep>('phone_input');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transaction, setTransaction] = useState<KCBPaymentTransaction | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [isOpen, pollInterval]);

  if (!isOpen) return null;

  /**
   * Format phone number to KCB format (254XXXXXXXXX)
   */
  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('254')) {
      return digits;
    }

    if (digits.startsWith('0')) {
      return '254' + digits.substring(1);
    }

    if (digits.length === 9) {
      return '254' + digits;
    }

    return '254' + digits;
  };

  /**
   * Validate phone number format
   */
  const isValidPhone = (phone: string): boolean => {
    const formatted = formatPhoneNumber(phone);
    return /^254[0-9]{9}$/.test(formatted);
  };

  /**
   * Initiate STK Push payment
   */
  const handleInitiatePayment = async () => {
    if (!isValidPhone(phoneNumber)) {
      setErrorMessage('Please enter a valid phone number (e.g., 0712345678 or 254712345678)');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const client = new KCBClient();
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Create payment transaction record
      const tx = await saveKCBPaymentTransaction({
        id: `kcb_${Date.now()}`,
        message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        correlation_id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        phone_number: formattedPhone,
        amount: Math.round(amount * 100), // Convert to cents
        invoice_number: invoiceNumber,
        description: description || `Invoice ${invoiceNumber}`,
        merchant_name: 'Jimwas POS',
        status: 'pending' as const,
        ipn_received: false,
        retry_count: 0,
        should_poll: true,
        request_payload: {
          phoneNumber: formattedPhone,
          amount,
          invoiceNumber,
          description,
        } as unknown as Record<string, unknown>,
      });

      setTransaction(tx);
      setStep('processing');

      // Initiate STK Push
      const payload = await client.initiateSTKPush({
        phoneNumber: formattedPhone,
        amount,
        invoiceNumber,
        description: description || `Invoice ${invoiceNumber}`,
        expiryTime: 3,
      });

      // Update transaction with KCB response
      await updateKCBTransactionStatus(tx.id, 'processing', {
        kcb_status_code: (payload as any)?.status?.code,
        kcb_error_code: (payload as any)?.status?.errorCode,
        kcb_error_message: (payload as any)?.status?.errorMessage,
        mpesa_request_id: (payload as any)?.requestId || (payload as any)?.ResponseID,
      });

      toast.show('STK Push sent to ' + formattedPhone, 'success');

      // Start polling for payment status
      setStep('polling');
      startPollingForStatus(tx.id);
    } catch (error) {
      console.error('[v0] Payment initiation error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initiate payment');
      setStep('failed');
      setIsProcessing(false);
      toast.show('Payment initiation failed', 'error');
    }
  };

  /**
   * Poll for payment status from KCB
   */
  const startPollingForStatus = (transactionId: string) => {
    let attempts = 0;
    const maxAttempts = 40; // ~4 minutes with 6-second intervals
    const pollingInterval = 6000; // 6 seconds

    const pollStatus = async () => {
      attempts++;
      setPollCount(attempts);

      try {
        const updatedTx = await getKCBPaymentTransaction(transactionId);

        if (!updatedTx) {
          setErrorMessage('Transaction not found');
          setStep('failed');
          return;
        }

        setTransaction(updatedTx);

        // Check if payment completed
        if (updatedTx.status === 'success') {
          setStep('success');
          await markKCBTransactionComplete(transactionId);
          clearInterval(interval);
          setPollInterval(null);
          toast.show('Payment successful!', 'success');
          setTimeout(() => {
            onPaymentComplete(updatedTx);
            handleClose();
          }, 2000);
          return;
        }

        if (updatedTx.status === 'failed' || updatedTx.status === 'cancelled') {
          setStep('failed');
          setErrorMessage(
            updatedTx.kcb_error_message || updatedTx.mpesa_response_description || 'Payment failed'
          );
          await markKCBTransactionComplete(transactionId);
          clearInterval(interval);
          setPollInterval(null);
          return;
        }

        // Stop polling after max attempts
        if (attempts >= maxAttempts) {
          setStep('failed');
          setErrorMessage('Payment timeout. Please check your phone for the M-Pesa prompt.');
          await updateKCBTransactionStatus(transactionId, 'timeout');
          await markKCBTransactionComplete(transactionId);
          clearInterval(interval);
          setPollInterval(null);
          return;
        }
      } catch (error) {
        console.error('[v0] Polling error:', error);
        // Continue polling even if there's an error
      }
    };

    const interval = setInterval(pollStatus, pollingInterval);
    setPollInterval(interval);

    // Initial poll
    pollStatus();
  };

  /**
   * Retry payment
   */
  const handleRetry = async () => {
    setStep('phone_input');
    setPhoneNumber('');
    setErrorMessage('');
    setPollCount(0);
    setTransaction(null);
    setIsProcessing(false);
  };

  /**
   * Close modal
   */
  const handleClose = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setStep('phone_input');
    setPhoneNumber('');
    setErrorMessage('');
    setPollCount(0);
    setTransaction(null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-emerald-500/30 max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-900/30 px-6 py-4 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-emerald-400">KCB M-Pesa Payment</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-emerald-900/30 rounded-lg transition"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Amount Display */}
          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <p className="text-sm text-slate-400 mb-1">Payment Amount</p>
            <p className="text-2xl font-bold text-emerald-400">KES {amount.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2">Invoice: {invoiceNumber}</p>
          </div>

          {/* Phone Input Step */}
          {step === 'phone_input' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="0712345678 or 254712345678"
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  disabled={isProcessing}
                />
                <p className="text-xs text-slate-500 mt-1">Enter your M-Pesa registered phone number</p>
              </div>

              {errorMessage && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <button
                onClick={handleInitiatePayment}
                disabled={!phoneNumber || isProcessing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initiating...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Send STK Push
                  </>
                )}
              </button>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && transaction && (
            <div className="space-y-3">
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <p className="text-center text-slate-300">Sending payment request to KCB...</p>
              <p className="text-xs text-center text-slate-500">Transaction: {transaction.id.substring(0, 12)}...</p>
            </div>
          )}

          {/* Polling Step */}
          {step === 'polling' && transaction && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <p className="text-sm font-medium text-blue-300">Waiting for M-Pesa confirmation...</p>
                </div>
                <p className="text-xs text-blue-400/80">
                  Enter your M-Pesa PIN on your phone. This typically takes 10-30 seconds.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-white font-mono">{transaction.phone_number}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status:</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-900/30 text-yellow-400">
                    {transaction.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Attempts:</span>
                  <span className="text-white">{pollCount}/40</span>
                </div>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${(pollCount / 40) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && transaction && (
            <div className="space-y-3">
              <div className="flex items-center justify-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
              <h3 className="text-center text-lg font-semibold text-green-400">Payment Successful!</h3>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt:</span>
                  <span className="text-green-400 font-mono">{transaction.mpesa_receipt_number || 'Pending'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white">KES {(transaction.amount / 100).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-center text-slate-500">Transaction ID: {transaction.id.substring(0, 12)}...</p>
            </div>
          )}

          {/* Failed Step */}
          {step === 'failed' && transaction && (
            <div className="space-y-3">
              <div className="flex items-center justify-center py-4">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h3 className="text-center text-lg font-semibold text-red-400">Payment Failed</h3>
              {errorMessage && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-red-400">{transaction.status.toUpperCase()}</span>
                </div>
                {transaction.kcb_error_code && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Error Code:</span>
                    <span className="text-red-400">{transaction.kcb_error_code}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleRetry}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'phone_input' || step === 'failed') && (
          <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/50">
            <button
              onClick={handleClose}
              className="w-full py-2 text-slate-400 hover:text-slate-300 font-medium transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
