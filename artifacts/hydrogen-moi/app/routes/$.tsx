/**
 * Catch-all 404 route.
 * Shown when no other route matches.
 */
import { type MetaFunction } from '@remix-run/react';
import { motion } from 'framer-motion';

export const meta: MetaFunction = () => [{ title: '404 — Moi' }];

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: '#faf8f5' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p
          className="text-[9px] tracking-[0.5em] uppercase mb-4"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            fontWeight: 300,
            color: '#1e1814',
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}
        >
          Page not found
        </h1>
        <p
          className="mt-5 text-sm leading-7"
          style={{ color: '#7a6e64', maxWidth: 340 }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center">
          <a
            href="/"
            className="text-xs tracking-[0.35em] uppercase border px-8 py-3.5 transition-colors hover:bg-[#1e1814] hover:text-white"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              borderColor: '#1e1814',
              color: '#1e1814',
            }}
          >
            Go Home
          </a>
          <a
            href="/search"
            className="text-xs tracking-[0.35em] uppercase border px-8 py-3.5 transition-colors hover:opacity-70"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              borderColor: 'rgba(30,24,20,0.25)',
              color: '#7a6e64',
            }}
          >
            Search
          </a>
        </div>
      </motion.div>
    </div>
  );
}
