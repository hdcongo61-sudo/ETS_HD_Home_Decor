import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Fine barre de progression affichée tout en haut pendant les changements de
 * route. Non bloquante, alignée sur la marque, invisible au premier rendu.
 */
const RouteProgressBar = () => {
  const location = useLocation();
  const firstRender = useRef(true);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let t1;
    let t2;
    setVisible(true);
    setDone(false);
    // Monte à ~85% pendant le chargement, puis termine et disparaît.
    t1 = setTimeout(() => setDone(true), 650);
    t2 = setTimeout(() => setVisible(false), 1050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location.pathname, location.search]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={location.key}
            initial={{ width: '0%', opacity: 1 }}
            animate={{ width: done ? '100%' : '85%', opacity: done ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{
              width: { duration: done ? 0.25 : 0.55, ease: done ? 'easeIn' : 'easeOut' },
              opacity: { duration: 0.25 },
            }}
            className="h-full rounded-r-full"
            style={{
              background:
                'linear-gradient(90deg, var(--colorBrandBackground), #60a5fa, var(--colorBrandBackground))',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RouteProgressBar;
