import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Truck, Repeat, Percent, Tag, Copy,
  CheckCircle2, Trash2, Edit2, Power, PowerOff, Ticket,
  Plus, X, ChevronDown, ArrowRight, Sparkles, Calendar,
  Target, Settings2, ChevronLeft
} from 'lucide-react';
import { Button, Input, Badge, useToast, Label, Switch } from '../UI';
import { supabase } from '../../services/supabaseClient';
import { isValidPrice } from '../../src/security';
import { Offer } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';

export const StepBar = ({ step, total }: { step: number; total: number }) => (
  <div className="flex items-center gap-1.5 mb-6">
    {Array.from({ length: total }).map((_, i) => (
      <motion.div key={i}
        animate={{ width: i === step ? 24 : 8, opacity: i <= step ? 1 : 0.25 }}
        className="h-1.5 rounded-full bg-brand-500"
        transition={{ duration: 0.3 }}
      />
    ))}
    <span className="text-[10px] text-foreground/30 font-bold ml-1">{step + 1} / {total}</span>
  </div>
);

// ── Create / edit modal ───────────────────────────────────────────────────────