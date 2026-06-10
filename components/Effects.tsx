
import React, { useRef, useState, useEffect } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

// --- MAGNETIC EFFECT ---
interface MagneticProps {
 children: React.ReactElement;
 strength?: number;
}

export const Magnetic: React.FC<MagneticProps> = ({ children, strength = 0.5 }) => {
 const ref = useRef<HTMLDivElement>(null);
 const x = useMotionValue(0);
 const y = useMotionValue(0);

 const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
 const springX = useSpring(x, springConfig);
 const springY = useSpring(y, springConfig);

 const handleMouseMove = (e: React.MouseEvent) => {
 if (!ref.current) return;
 const { clientX, clientY } = e;
 const { left, top, width, height } = ref.current.getBoundingClientRect();
 const centerX = left + width / 2;
 const centerY = top + height / 2;
 const distanceX = clientX - centerX;
 const distanceY = clientY - centerY;

 x.set(distanceX * strength);
 y.set(distanceY * strength);
 };

 const handleMouseLeave = () => {
 x.set(0);
 y.set(0);
 };

 return (
 <motion.div
 ref={ref}
 onMouseMove={handleMouseMove}
 onMouseLeave={handleMouseLeave}
 style={{ x: springX, y: springY }}
 >
 {children}
 </motion.div>
 );
};
