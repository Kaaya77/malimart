import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  onDelete: () => void;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  /** Reveal label (default "Delete"). */
  label?: string;
  /** Reveal icon (default Trash2). */
  icon?: React.ElementType;
  /** Reveal background class (default "bg-red-500"). */
  bgClass?: string;
  /** When true the row doesn't swipe (e.g. an order that can't be cancelled). */
  disabled?: boolean;
  /** If false, the row snaps back after firing (for actions that open a modal
   *  rather than removing the row). Default true (row flies off-screen). */
  removeOnAction?: boolean;
}

export const SwipeableRow = ({
  onDelete, children, className = '', threshold = 72,
  label = 'Delete', icon: Icon = Trash2, bgClass = 'bg-red-500',
  disabled = false, removeOnAction = true,
}: SwipeableRowProps) => {
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [-threshold, -threshold / 2], [1, 0]);
  const revealScale = useTransform(x, [-threshold, -threshold / 2], [1, 0.7]);
  const triggered = useRef(false);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -threshold && !triggered.current) {
      triggered.current = true;
      if (removeOnAction) {
        animate(x, -window.innerWidth, { duration: 0.25, ease: 'easeIn' }).then(() => {
          onDelete();
          triggered.current = false;
        });
      } else {
        onDelete();
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 }).then(() => { triggered.current = false; });
      }
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  if (disabled) return <div className={className}>{children}</div>;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Action reveal */}
      <div className={`absolute inset-y-0 right-0 w-20 ${bgClass} flex flex-col items-center justify-center gap-1 select-none`}>
        <motion.div style={{ opacity: revealOpacity, scale: revealScale }} className="flex flex-col items-center gap-1">
          <Icon className="w-5 h-5 text-white" />
          <span className="text-[8px] font-black uppercase tracking-wider text-white">{label}</span>
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
