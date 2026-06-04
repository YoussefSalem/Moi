import { type MetaFunction } from '@remix-run/react';
import { motion } from 'framer-motion';
import { Instagram } from 'lucide-react';
import { Footer } from '~/components/Footer';

export const meta: MetaFunction = () => [
  { title: 'Ambassador Programme — Moi' },
  {
    name: 'description',
    content: 'Join the Moi ambassador programme. Collaborate with us and share your love for effortless fashion.',
  },
];

export default function AmbassadorPage() {
  return (
    <div style={{ backgroundColor: '#1a1410', minHeight: '100vh' }}>
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 md:px-12"
        style={{
          paddingTop: 'clamp(130px, 22vw, 220px)',
          paddingBottom: 'clamp(70px, 12vw, 120px)',
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(210,195,175,0.06) 0%, transparent 70%)',
          }}
        />

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-[9px] tracking-[0.6em] uppercase mb-6 relative z-10"
          style={{ color: 'rgba(200,185,165,0.48)', fontFamily: "'Montserrat', sans-serif" }}
        >
          Join the Moi Family
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(2.8rem, 9vw, 6.5rem)',
            fontWeight: 300,
            color: '#fff',
            letterSpacing: '0.06em',
            lineHeight: 0.95,
          }}
        >
          Ambassador
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.35 }}
          className="mt-8 mb-10 relative z-10"
          style={{ width: 48, height: 1, backgroundColor: 'rgba(200,185,165,0.3)' }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="max-w-lg text-sm md:text-base leading-8 relative z-10"
          style={{ color: 'rgba(200,185,165,0.65)', fontWeight: 300 }}
        >
          We partner with creators, fashion enthusiasts, and everyday stylists
          who love Moi. Share your style, inspire others, and earn with every
          sale you drive.
        </motion.p>
      </div>

      {/* Benefits */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
        >
          {[
            {
              icon: '✦',
              title: 'Earn Commission',
              body: 'Receive a percentage on every sale you generate through your unique referral link.',
            },
            {
              icon: '◈',
              title: 'Exclusive Pieces',
              body: 'Get early access to new drops and exclusive pieces before they go public.',
            },
            {
              icon: '◇',
              title: 'Grow Together',
              body: 'Be featured on our channels and grow your personal brand alongside Moi.',
            },
          ].map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p
                className="text-2xl mb-4"
                style={{ color: 'rgba(200,185,165,0.6)' }}
              >
                {benefit.icon}
              </p>
              <p
                className="text-base mb-2"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 300,
                  letterSpacing: '0.04em',
                }}
              >
                {benefit.title}
              </p>
              <p className="text-sm leading-7" style={{ color: 'rgba(200,185,165,0.55)' }}>
                {benefit.body}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Application form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7 }}
          className="max-w-lg mx-auto"
        >
          <p
            className="text-[10px] tracking-[0.4em] uppercase text-center mb-8"
            style={{ color: 'rgba(200,185,165,0.45)', fontFamily: "'Montserrat', sans-serif" }}
          >
            Apply Now
          </p>

          <form
            action="https://wa.me/201200520083"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-4"
          >
            <input
              type="text"
              placeholder="Your name"
              className="w-full bg-transparent border-b py-3 outline-none text-sm"
              style={{
                borderColor: 'rgba(200,185,165,0.2)',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: "'Montserrat', sans-serif",
              }}
            />
            <input
              type="text"
              placeholder="Instagram handle"
              className="w-full bg-transparent border-b py-3 outline-none text-sm"
              style={{
                borderColor: 'rgba(200,185,165,0.2)',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: "'Montserrat', sans-serif",
              }}
            />
            <input
              type="text"
              placeholder="Follower count"
              className="w-full bg-transparent border-b py-3 outline-none text-sm"
              style={{
                borderColor: 'rgba(200,185,165,0.2)',
                color: 'rgba(255,255,255,0.8)',
                fontFamily: "'Montserrat', sans-serif",
              }}
            />

            <a
              href="mailto:hello@buy-moi.com?subject=Ambassador%20Application"
              className="mt-4 flex items-center justify-center gap-3 py-4 text-[9px] tracking-[0.4em] uppercase transition-colors"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                border: '1px solid rgba(200,185,165,0.3)',
                color: 'rgba(200,185,165,0.8)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(200,185,165,0.08)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(200,185,165,0.8)';
              }}
            >
              <Instagram size={14} strokeWidth={1.5} />
              Apply via Email
            </a>
          </form>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
