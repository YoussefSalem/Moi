import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@shopify/remix-oxygen';
import { type MetaFunction } from '@remix-run/react';
import { useState } from 'react';
import { motion } from 'framer-motion';

export const meta: MetaFunction = () => [{ title: 'Sign In — Moi' }];

export async function loader({ context }: LoaderFunctionArgs) {
  const { customerAccount } = context;
  const isLoggedIn = await customerAccount.isLoggedIn();
  if (isLoggedIn) return redirect('/account');
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { customerAccount } = context;

  try {
    return customerAccount.login();
  } catch (error) {
    if (error instanceof Response) return error;
    return redirect('/account/login?error=true');
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#faf8f5' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm text-center"
      >
        {/* Logo */}
        <a
          href="/"
          className="font-serif text-3xl tracking-[0.3em] inline-block mb-12"
          style={{ color: '#1e1814' }}
        >
          MOI
        </a>

        <h1
          className="mb-3"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '2rem',
            fontWeight: 300,
            color: '#1e1814',
            letterSpacing: '0.05em',
          }}
        >
          My Account
        </h1>
        <p
          className="mb-10 text-sm leading-relaxed"
          style={{ color: '#7a6e64' }}
        >
          Sign in to view your orders and manage your account.
        </p>

        {/* Shopify Customer Account API login */}
        <form method="POST" onSubmit={() => setLoading(true)}>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-xs tracking-[0.4em] uppercase transition-all hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-3"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              backgroundColor: '#1e1814',
              color: '#faf8f5',
            }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p
          className="mt-8 text-xs tracking-[0.12em] leading-relaxed"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
        >
          Your account is managed securely by Shopify.
        </p>

        <a
          href="/"
          className="mt-6 inline-block text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-60"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
        >
          ← Back to shop
        </a>
      </motion.div>
    </div>
  );
}
