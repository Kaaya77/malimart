import React from 'react';
import { LucideIcon } from 'lucide-react';

interface UpsellOpportunity {
  type: 'bogo' | 'spend';
  title: string;
  msg: string;
  action: () => void;
  icon: LucideIcon;
}

export const UpsellBanner: React.FC<{ opportunity: UpsellOpportunity }> = ({ opportunity }) => (
  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-background/20 backdrop-blur-md rounded-full">
        <opportunity.icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="font-black uppercase tracking-wide text-sm">{opportunity.title}</h4>
        <p className="text-xs font-medium opacity-90">{opportunity.msg}</p>
      </div>
    </div>
    <button
      onClick={opportunity.action}
      className="px-5 py-2 bg-background text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-background/90 transition-colors shadow-sm whitespace-nowrap"
    >
      {opportunity.type === 'bogo' ? 'Add Now' : 'Shop Now'}
    </button>
  </div>
);
