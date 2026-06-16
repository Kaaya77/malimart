import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
  onBack?: () => void;
}

export const BackButton = ({ to, label, className = '', onBack }: BackButtonProps) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onBack) { onBack(); return; }
    if (to) { navigate(to); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={handleClick}
      className={`inline-flex items-center gap-2 h-9 px-3 -ml-1 rounded-xl text-foreground/55 hover:text-foreground hover:bg-foreground/[0.06] transition-all text-sm font-semibold ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
      {label && <span>{label}</span>}
    </motion.button>
  );
};
