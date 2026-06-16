import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  onDelete: () => void;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}

export const SwipeableRow = ({ onDelete, children, className = '', threshold = 72 }: SwipeableRowProps) => {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-threshold, -threshold / 2], [1, 0]);
  const deleteScale = useTransform(x, [-threshold, -threshold / 2], [1, 0.7]);
  const triggered = useRef(false);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -threshold && !triggered.current) {
      triggered.current = true;
      animate(x, -window.innerWidth, { duration: 0.25, ease: 'easeIn' }).then(() => {
        onDelete();
        triggered.current = false;
      });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Delete reveal */}
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex flex-col items-center justify-center gap-1 select-none">
        <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }} className="flex flex-col items-center gap-1">
          <Trash2 className="w-5 h-5 text-white" />
          <span className="text-[8px] font-black uppercase tracking-wider text-white">Delete</span>
        </motion.div>
      </div>
      <motion.div
        style={{ x, touchAction: 'pan-y' } as any}
        drag="x"
        dragConstraints={{ left: -threshold * 1.5, right: 0 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
};
