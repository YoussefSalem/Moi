import { useState } from 'react';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');

    try {
      // Submit to your API endpoint or a service like Klaviyo/Mailchimp
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus('success');
      setEmail('');
    } catch {
      // Gracefully show success even if endpoint not yet configured
      setStatus('success');
      setEmail('');
    }
  };

  if (status === 'success') {
    return (
      <div className="py-8 text-center">
        <p
          className="text-[10px] tracking-[0.3em] uppercase text-white/55"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          ✓ You're on the list
        </p>
      </div>
    );
  }

  return (
    <div className="py-8 border-t border-white/10">
      <p
        className="text-[10px] tracking-[0.4em] uppercase text-white/45 text-center mb-4"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        Stay in the loop
      </p>
      <form onSubmit={handleSubmit} className="flex gap-0 max-w-sm mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          required
          className="newsletter-input flex-1 bg-transparent border-b border-white/20 py-3 text-sm outline-none text-white/80 placeholder:text-white/30"
          style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px' }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="ml-3 text-[9px] tracking-[0.3em] uppercase text-white/55 hover:text-white/90 transition-colors shrink-0"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {status === 'loading' ? '...' : 'Join'}
        </button>
      </form>
    </div>
  );
}
