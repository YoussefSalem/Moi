import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  ready: boolean;
}

export function LoadingScreen({ ready }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ backgroundColor: '#faf8f5' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <motion.p
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="font-serif tracking-[0.35em] text-3xl select-none"
              style={{ color: '#1e1814', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              MOI
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
