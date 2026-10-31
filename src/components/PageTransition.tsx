//src/components/PageTransition.tsx
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useOutlet } from 'react-router-dom';

/**
 * Membungkus <Outlet /> agar setiap perpindahan halaman
 * memiliki animasi masuk/keluar yang halus (spring physics).
 */
export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 32,
          mass: 0.8,
        }}
        className="h-full"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}