// src/components/PageTransition.tsx
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Membungkus isi halaman agar setiap perpindahan route
 * memiliki animasi masuk yang halus (spring physics).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 32,
        mass: 0.8,
      }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}