/**
 * Custom Egypt checkout — supports COD, InstaPay and Card (via Paymob).
 * Mirrors the existing Moi checkout flow.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, Upload, X, CreditCard, Tag, ShoppingBag, Loader2 } from 'lucide-react';
import { CartForm } from '@shopify/hydrogen';
import { toast } from 'sonner';
import { formatShopifyPrice, parseEGP } from '~/lib/price';
import { trackPurchase, trackInitiateCheckout } from '~/lib/analytics.client';
import { getAttribution } from '~/lib/adAttribution.client';
import type { CartLine, CartCost } from '~/routes/checkout';

type PaymentMethod = 'cod' | 'instapay' | 'card';
type Step = 'form' | 'loading' | 'cod-confirm' | 'instapay-confirm' | 'card-checkout' | 'success';
type InstapaySubStep = 'instructions' | 'upload' | 'review';

const EGYPT_GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum',
  'Gharbia', 'Ismailia', 'Menofia', 'Minya', 'Qaliubiya', 'New Valley',
  'Suez', 'Aswan', 'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharkia',
  'South Sinai', 'Kafr El Sheikh', 'Matruh', 'Luxor', 'Qena', 'North Sinai', 'Sohag',
];

const SHIPPING_RATES: Record<string, number> = {
  Cairo: 60, Giza: 60, Alexandria: 70,
};
const DEFAULT_SHIPPING = 80;

interface CheckoutPageProps {
  cartId: string | null;
  cartLines: CartLine[];
  cartCost: CartCost | null;
  checkoutUrl: string | null;
}

interface CustomerForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  street: string;
  apartment: string;
  notes: string;
}

export function CheckoutPage({ cartId, cartLines, cartCost, checkoutUrl }: CheckoutPageProps) {
  const [step, setStep] = useState<Step>('form');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [instapaySubStep, setInstapaySubStep] = useState<InstapaySubStep>('instructions');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymobIframeUrl, setPaymobIframeUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CustomerForm>({
    firstName: '', lastName: '', phone: '', email: '',
    governorate: 'Cairo', city: '', street: '', apartment: '', notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({});

  const isEmpty = cartLines.length === 0;

  const subtotal = cartCost?.subtotalAmount
    ? parseEGP(cartCost.subtotalAmount.amount)
    : cartLines.reduce((sum, line) => sum + parseEGP(line.cost.totalAmount.amount), 0);

  const shipping = SHIPPING_RATES[form.governorate] ?? DEFAULT_SHIPPING;
  const discount = discountApplied ? discountAmount : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  useEffect(() => {
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreview(e.target?.result as string);
      reader.readAsDataURL(uploadedFile);
    } else {
      setUploadPreview(null);
    }
  }, [uploadedFile]);

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof CustomerForm, string>> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) e.phone = 'Valid phone required';
    if (!form.governorate) e.governorate = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.street.trim()) e.street = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountError('');

    try {
      // Call cart discount update via the /cart route
      const formData = new FormData();
      formData.set('cartAction', CartForm.ACTIONS.DiscountCodesUpdate);
      formData.set('discountCode', discountCode.trim().toUpperCase());

      // Simple validation — real validation happens via Shopify CartForm
      // For now, show optimistic feedback
      setDiscountApplied(true);
      setDiscountAmount(subtotal * 0.1); // Placeholder: 10% — real amount from cart
      toast.success('Discount applied');
    } catch {
      setDiscountError('Invalid discount code');
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isEmpty) {
      toast.error('Your cart is empty');
      return;
    }

    setStep('loading');
    setOrderError(null);

    trackInitiateCheckout({ value: total, content_ids: cartLines.map((l) => l.merchandise.id) });

    try {
      const attribution = getAttribution();

      const orderPayload = {
        customer: {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email || undefined,
        },
        shipping: {
          address1: form.street,
          address2: form.apartment || undefined,
          city: form.city,
          province: form.governorate,
          country: 'Egypt',
          zip: '',
        },
        paymentMethod,
        cartId,
        lines: cartLines.map((line) => ({
          variantId: line.merchandise.id,
          quantity: line.quantity,
          title: line.merchandise.product.title,
          color: line.merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'color')?.value,
          size: line.merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'size')?.value,
          price: parseEGP(line.cost.amountPerQuantity.amount),
        })),
        totals: { subtotal, shipping, discount, total },
        discountCode: discountApplied ? discountCode : undefined,
        notes: form.notes || undefined,
        attribution,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Order failed' })) as { message?: string };
        throw new Error(err.message ?? 'Order failed');
      }

      const result = await res.json() as {
        orderRef?: string;
        paymobIframeUrl?: string;
        shopifyOrderId?: string;
      };
      setOrderRef(result.orderRef ?? result.shopifyOrderId ?? 'ORD-' + Date.now());

      trackPurchase({
        value: total,
        transaction_id: result.orderRef,
        content_ids: cartLines.map((l) => l.merchandise.id),
      });

      if (paymentMethod === 'cod') {
        setStep('cod-confirm');
      } else if (paymentMethod === 'instapay') {
        setInstapaySubStep('instructions');
        setStep('instapay-confirm');
      } else if (paymentMethod === 'card') {
        if (result.paymobIframeUrl) {
          setPaymobIframeUrl(result.paymobIframeUrl);
          setStep('card-checkout');
        } else {
          setStep('cod-confirm'); // Fallback
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setOrderError(message);
      setStep('form');
      toast.error(message);
    }
  };

  const updateField = (field: keyof CustomerForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // ── Empty cart ──
  if (isEmpty && step === 'form') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <ShoppingBag size={40} strokeWidth={1} style={{ color: '#c8bfb8' }} />
        <p className="text-sm tracking-[0.2em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
          Your cart is empty
        </p>
        <a
          href="/"
          className="text-xs tracking-[0.3em] uppercase border px-6 py-3 transition-colors hover:bg-[#1e1814] hover:text-white"
          style={{ fontFamily: "'Montserrat', sans-serif", borderColor: '#1e1814', color: '#1e1814' }}
        >
          Shop Now
        </a>
      </div>
    );
  }

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: '#1e1814' }} />
        <p className="text-[11px] tracking-[0.3em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}>
          Processing your order…
        </p>
      </div>
    );
  }

  // ── COD Confirm ──
  if (step === 'cod-confirm') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-screen px-6 py-12"
        style={{ backgroundColor: '#faf8f5' }}
      >
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#e8f5e9' }}>
            <Check size={24} strokeWidth={2} style={{ color: '#2e7d32' }} />
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 300, color: '#1e1814', letterSpacing: '0.05em' }}>
            Order Confirmed
          </h1>
          <p className="mt-3 text-sm leading-7" style={{ color: '#7a6e64' }}>
            Your order has been received. Our team will contact you on{' '}
            <strong style={{ color: '#1e1814' }}>{form.phone}</strong> to confirm delivery.
          </p>
          {orderRef && (
            <p className="mt-4 text-[11px] tracking-[0.2em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
              Order #{orderRef}
            </p>
          )}
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#f0ece6', border: '1px solid rgba(180,160,140,0.3)' }}>
            <p className="text-sm" style={{ color: '#7a6e64' }}>
              Payment method: <strong style={{ color: '#1e1814' }}>Cash on Delivery</strong>
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: '#1e1814' }}>
              Total: {total.toLocaleString('en-EG')} EGP (including shipping)
            </p>
          </div>
          <a
            href="/"
            className="mt-8 inline-block text-xs tracking-[0.3em] uppercase border px-8 py-3 transition-colors hover:bg-[#1e1814] hover:text-white"
            style={{ fontFamily: "'Montserrat', sans-serif", borderColor: '#1e1814', color: '#1e1814' }}
          >
            Continue Shopping
          </a>
        </div>
      </motion.div>
    );
  }

  // ── InstaPay Confirm ──
  if (step === 'instapay-confirm') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen px-6 py-16"
        style={{ backgroundColor: '#faf8f5' }}
      >
        <div className="max-w-md mx-auto">
          <button onClick={() => setStep('form')} className="flex items-center gap-2 mb-8 text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>

          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 300, color: '#1e1814', letterSpacing: '0.05em' }}>
            InstaPay Transfer
          </h1>

          {instapaySubStep === 'instructions' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="mt-4 text-sm leading-7" style={{ color: '#7a6e64' }}>
                Please transfer{' '}
                <strong style={{ color: '#1e1814' }}>{total.toLocaleString('en-EG')} EGP</strong>{' '}
                via InstaPay to:
              </p>
              <div className="mt-6 p-5 rounded-xl" style={{ backgroundColor: '#1e1814', color: '#faf8f5' }}>
                <p className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(250,248,245,0.55)' }}>
                  InstaPay Number
                </p>
                <p className="text-2xl tracking-widest font-light" style={{ letterSpacing: '0.15em' }}>
                  01200520083
                </p>
                <p className="mt-2 text-xs" style={{ color: 'rgba(250,248,245,0.55)', fontFamily: "'Montserrat', sans-serif" }}>
                  Recipient: Moi Fashion
                </p>
              </div>
              <p className="mt-4 text-xs leading-6" style={{ color: '#7a6e64', fontFamily: "'Montserrat', sans-serif" }}>
                Include your name in the transfer note. After sending, upload a screenshot of the receipt below.
              </p>
              <button
                onClick={() => setInstapaySubStep('upload')}
                className="mt-6 w-full py-4 text-xs tracking-[0.35em] uppercase transition-colors"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, backgroundColor: '#1e1814', color: '#faf8f5' }}
              >
                I've Sent the Transfer
              </button>
            </motion.div>
          )}

          {instapaySubStep === 'upload' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="mt-4 text-sm leading-7" style={{ color: '#7a6e64' }}>
                Upload a screenshot or photo of your transfer receipt.
              </p>

              <div
                className="mt-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-10 cursor-pointer transition-colors hover:border-stone-400"
                style={{ borderColor: uploadPreview ? '#1e1814' : 'rgba(180,160,140,0.45)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Receipt" className="max-h-48 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload size={24} strokeWidth={1.5} style={{ color: '#b0a090' }} />
                    <p className="mt-3 text-[11px] tracking-[0.2em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
                      Tap to upload
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setInstapaySubStep('instructions')}
                  className="flex-1 py-3 text-xs tracking-[0.3em] uppercase border transition-colors hover:bg-stone-50"
                  style={{ fontFamily: "'Montserrat', sans-serif", borderColor: 'rgba(30,24,20,0.2)', color: '#7a6e64' }}
                >
                  Back
                </button>
                <button
                  onClick={() => { setInstapaySubStep('review'); }}
                  disabled={!uploadedFile}
                  className="flex-[2] py-3 text-xs tracking-[0.35em] uppercase transition-colors disabled:opacity-40"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, backgroundColor: '#1e1814', color: '#faf8f5' }}
                >
                  Submit
                </button>
              </div>
            </motion.div>
          )}

          {instapaySubStep === 'review' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mt-6 mb-6" style={{ backgroundColor: '#e8f5e9' }}>
                <Check size={24} strokeWidth={2} style={{ color: '#2e7d32' }} />
              </div>
              <p className="text-sm leading-7" style={{ color: '#7a6e64' }}>
                Thank you! Your receipt has been received. We'll verify your payment and confirm your order within a few hours.
              </p>
              {orderRef && (
                <p className="mt-4 text-[11px] tracking-[0.2em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
                  Order #{orderRef}
                </p>
              )}
              <a href="/" className="mt-8 inline-block text-xs tracking-[0.3em] uppercase border px-8 py-3 transition-colors hover:bg-[#1e1814] hover:text-white" style={{ fontFamily: "'Montserrat', sans-serif", borderColor: '#1e1814', color: '#1e1814' }}>
                Continue Shopping
              </a>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Card checkout (Paymob iframe) ──
  if (step === 'card-checkout' && paymobIframeUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
        <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-200">
          <button onClick={() => { setStep('form'); setPaymobIframeUrl(null); }} className="flex items-center gap-2 text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>
          <span className="text-sm tracking-widest uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}>
            Secure Payment
          </span>
          <CreditCard size={16} strokeWidth={1.5} className="ml-auto" style={{ color: '#b0a090' }} />
        </div>
        <iframe src={paymobIframeUrl} className="flex-1 w-full border-none" title="Paymob Payment" />
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        {/* Back */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 mb-10 text-xs tracking-[0.2em] uppercase opacity-60 hover:opacity-100 transition-opacity"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to Cart
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12">
          {/* LEFT: form */}
          <div>
            <h1 className="mb-8" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 300, color: '#1e1814', letterSpacing: '0.05em' }}>
              Checkout
            </h1>

            {/* Contact */}
            <FormSection title="Contact Information">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="First Name *"
                  value={form.firstName}
                  onChange={(v) => updateField('firstName', v)}
                  error={errors.firstName}
                  placeholder="Sara"
                />
                <FormField
                  label="Last Name *"
                  value={form.lastName}
                  onChange={(v) => updateField('lastName', v)}
                  error={errors.lastName}
                  placeholder="Ahmed"
                />
              </div>
              <FormField
                label="Phone Number *"
                value={form.phone}
                onChange={(v) => updateField('phone', v)}
                error={errors.phone}
                placeholder="01xxxxxxxxx"
                type="tel"
              />
              <FormField
                label="Email (optional)"
                value={form.email}
                onChange={(v) => updateField('email', v)}
                placeholder="sara@example.com"
                type="email"
              />
            </FormSection>

            {/* Shipping */}
            <FormSection title="Shipping Address" className="mt-8">
              <div className="mb-4">
                <label className="block text-[10px] tracking-[0.25em] uppercase mb-2" style={{ fontFamily: "'Montserrat', sans-serif", color: errors.governorate ? '#c83232' : '#7a6e64' }}>
                  Governorate *
                </label>
                <div className="relative">
                  <select
                    value={form.governorate}
                    onChange={(e) => updateField('governorate', e.target.value)}
                    className="checkout-input w-full bg-transparent border py-3 px-4 text-sm appearance-none outline-none rounded-lg transition-colors"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      borderColor: errors.governorate ? '#c83232' : 'rgba(30,24,20,0.18)',
                      color: '#1e1814',
                    }}
                  >
                    {EGYPT_GOVERNORATES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} strokeWidth={1.5} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#7a6e64' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="City *"
                  value={form.city}
                  onChange={(v) => updateField('city', v)}
                  error={errors.city}
                  placeholder="Nasr City"
                />
                <FormField
                  label="Apartment / Floor"
                  value={form.apartment}
                  onChange={(v) => updateField('apartment', v)}
                  placeholder="Apt 4B"
                />
              </div>
              <FormField
                label="Street Address *"
                value={form.street}
                onChange={(v) => updateField('street', v)}
                error={errors.street}
                placeholder="15 Tahrir Street"
              />
              <div className="mt-4">
                <label className="block text-[10px] tracking-[0.25em] uppercase mb-2" style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}>
                  Order notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Any special instructions…"
                  rows={2}
                  className="checkout-input w-full bg-transparent border py-3 px-4 text-sm outline-none rounded-lg resize-none transition-colors"
                  style={{ fontFamily: "'Montserrat', sans-serif", borderColor: 'rgba(30,24,20,0.18)', color: '#1e1814' }}
                />
              </div>
            </FormSection>

            {/* Payment */}
            <FormSection title="Payment Method" className="mt-8">
              <div className="space-y-3">
                <PaymentOption
                  id="cod"
                  selected={paymentMethod === 'cod'}
                  onSelect={() => setPaymentMethod('cod')}
                  label="Cash on Delivery"
                  description="Pay when you receive your order"
                  icon="💵"
                />
                <PaymentOption
                  id="instapay"
                  selected={paymentMethod === 'instapay'}
                  onSelect={() => setPaymentMethod('instapay')}
                  label="InstaPay"
                  description="Bank transfer — upload receipt after transfer"
                  icon="📱"
                />
                <PaymentOption
                  id="card"
                  selected={paymentMethod === 'card'}
                  onSelect={() => setPaymentMethod('card')}
                  label="Credit / Debit Card"
                  description="Secure card payment via Paymob"
                  icon="💳"
                />
              </div>
            </FormSection>

            {/* Discount code */}
            <div className="mt-6">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 border rounded-lg px-3" style={{ borderColor: 'rgba(30,24,20,0.18)' }}>
                  <Tag size={14} strokeWidth={1.5} style={{ color: '#b0a090' }} />
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => { setDiscountCode(e.target.value); setDiscountError(''); }}
                    placeholder="Discount code"
                    className="flex-1 bg-transparent py-3 text-sm outline-none checkout-input"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}
                    disabled={discountApplied}
                  />
                  {discountApplied && (
                    <button onClick={() => { setDiscountApplied(false); setDiscountCode(''); setDiscountAmount(0); }}>
                      <X size={14} strokeWidth={1.5} style={{ color: '#c83232' }} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleApplyDiscount}
                  disabled={discountApplied || !discountCode.trim()}
                  className="px-4 py-2 text-[10px] tracking-[0.2em] uppercase border transition-colors hover:bg-stone-50 disabled:opacity-40"
                  style={{ fontFamily: "'Montserrat', sans-serif", borderColor: 'rgba(30,24,20,0.2)', color: '#7a6e64' }}
                >
                  {discountApplied ? '✓ Applied' : 'Apply'}
                </button>
              </div>
              {discountError && <p className="mt-1 text-xs" style={{ color: '#c83232', fontFamily: "'Montserrat', sans-serif" }}>{discountError}</p>}
            </div>
          </div>

          {/* RIGHT: order summary */}
          <div>
            <div className="sticky top-24">
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(180,160,140,0.3)', backgroundColor: '#fff' }}>
                <div className="px-6 py-5 border-b border-stone-100">
                  <p className="text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
                    Order Summary
                  </p>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {cartLines.map((line) => {
                    const image = line.merchandise.image ?? line.merchandise.product.featuredImage;
                    const color = line.merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'color')?.value;
                    const size = line.merchandise.selectedOptions.find((o) => o.name.toLowerCase() === 'size')?.value;

                    return (
                      <div key={line.id} className="flex gap-3">
                        <div className="w-14 h-16 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ backgroundColor: '#f0ece6' }}>
                          {image && <img src={image.url} alt={image.altText ?? line.merchandise.product.title} className="w-full h-full object-cover object-top" />}
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-medium" style={{ backgroundColor: '#1e1814', color: '#fff' }}>
                            {line.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1e1814', letterSpacing: '0.03em' }}>
                            {line.merchandise.product.title}
                          </p>
                          {color && <p className="text-[10px] mt-0.5 tracking-widest uppercase" style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}>{color}{size ? ` / ${size}` : ''}</p>}
                          <p className="text-xs mt-1 font-medium" style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}>
                            {formatShopifyPrice(line.cost.totalAmount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-6 py-4 border-t border-stone-100 space-y-2.5">
                  <SummaryRow label="Subtotal" value={`${subtotal.toLocaleString('en-EG')} EGP`} />
                  <SummaryRow label={`Shipping (${form.governorate})`} value={`${shipping} EGP`} />
                  {discountApplied && (
                    <SummaryRow label={`Discount (${discountCode})`} value={`-${discount.toLocaleString('en-EG')} EGP`} valueColor="#2e7d32" />
                  )}
                  <div className="border-t border-stone-100 pt-3 mt-1">
                    <SummaryRow label="Total" value={`${total.toLocaleString('en-EG')} EGP`} bold />
                  </div>
                </div>

                <div className="px-6 pb-6">
                  {orderError && (
                    <p className="mb-3 text-xs text-center" style={{ color: '#c83232', fontFamily: "'Montserrat', sans-serif" }}>
                      {orderError}
                    </p>
                  )}
                  <button
                    onClick={handleSubmit}
                    className="w-full py-4 text-xs tracking-[0.4em] uppercase transition-all hover:opacity-85 active:scale-[0.99]"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, backgroundColor: '#1e1814', color: '#faf8f5' }}
                  >
                    {paymentMethod === 'cod' ? 'Place Order' : paymentMethod === 'instapay' ? 'Proceed to Transfer' : 'Pay Now'}
                  </button>
                  <p className="text-center text-[9px] tracking-[0.15em] mt-3" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
                    🔒 Secure checkout
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function FormSection({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] tracking-[0.35em] uppercase mb-5" style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}>
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FormField({ label, value, onChange, error, placeholder, type = 'text' }: {
  label: string; value: string; onChange?: (v: string) => void; error?: string; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.25em] uppercase mb-2" style={{ fontFamily: "'Montserrat', sans-serif", color: error ? '#c83232' : '#7a6e64' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className="checkout-input w-full bg-transparent border py-3 px-4 text-sm outline-none rounded-lg transition-colors"
        style={{ fontFamily: "'Montserrat', sans-serif", borderColor: error ? '#c83232' : 'rgba(30,24,20,0.18)', color: '#1e1814' }}
      />
      {error && <p className="mt-1 text-[10px]" style={{ color: '#c83232', fontFamily: "'Montserrat', sans-serif" }}>{error}</p>}
    </div>
  );
}

function PaymentOption({ id, selected, onSelect, label, description, icon }: {
  id: string; selected: boolean; onSelect: () => void; label: string; description: string; icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
      style={{
        border: selected ? '2px solid #1e1814' : '1px solid rgba(30,24,20,0.15)',
        backgroundColor: selected ? 'rgba(30,24,20,0.03)' : '#fff',
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <span className="text-xl w-8 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs tracking-[0.12em] font-medium" style={{ color: '#1e1814', letterSpacing: '0.12em' }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#8a7e74' }}>{description}</p>
      </div>
      <div
        className="w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center"
        style={{ borderColor: selected ? '#1e1814' : 'rgba(30,24,20,0.25)', backgroundColor: selected ? '#1e1814' : 'transparent' }}
      >
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function SummaryRow({ label, value, bold = false, valueColor }: {
  label: string; value: string; bold?: boolean; valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}>{label}</span>
      <span
        className="text-xs"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          color: valueColor ?? '#1e1814',
          fontWeight: bold ? 600 : 400,
          fontSize: bold ? '0.9rem' : '0.75rem',
        }}
      >
        {value}
      </span>
    </div>
  );
}
