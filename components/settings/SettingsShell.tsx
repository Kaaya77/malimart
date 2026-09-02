import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BackButton } from '../BackButton';

/**
 * One settings chassis for every role.
 *
 * Buyer and Seller settings had grown into two unrelated designs: Buyer used a
 * plain title plus a simple pill sidebar, Seller used a store-identity header
 * with a progress ring and a heavier two-line nav with icon tiles. Same job,
 * two layouts, two sets of bugs to fix (the tab-overlap bug was fixed in Buyer
 * only, because Seller's markup did not match the pattern being patched).
 *
 * Role differences now live in DATA, not in duplicated layout:
 *   - `tabs`      — which sections that role gets
 *   - `subtitle`  — role-appropriate wording
 *   - `header`    — an optional slot, so Seller keeps its store identity and
 *                   setup progress. That is a real role difference worth
 *                   keeping, unlike two different navs.
 */

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Optional one-line hint, shown under the label on desktop only. */
  desc?: string;
}

interface SettingsShellProps {
  title: string;
  subtitle?: string;
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Role-specific block rendered above the nav (e.g. the seller store card). */
  header?: ReactNode;
  children: ReactNode;
}

export const SettingsShell: React.FC<SettingsShellProps> = ({
  title, subtitle, tabs, activeTab, onTabChange, header, children,
}) => (
  <div className="max-w-6xl mx-auto pb-12 animate-in fade-in">
    <div className="mb-6">
      <BackButton label="Back" className="mb-3" />
      <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
    </div>

    {header && <div className="mb-6">{header}</div>}

    <div className="flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <motion.nav
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
          }}
          // -mx-4 px-4 lets the row bleed to the screen edge on mobile so the
          // last tab is not visually clipped mid-scroll.
          className="flex flex-row md:flex-col gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0"
        >
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
                }}
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                // shrink-0 is load-bearing: without it a flex row squeezes each
                // button below its own whitespace-nowrap text, so labels
                // overlap and the shortest one clips. That was a real bug.
                className={`flex items-center gap-3 px-4 py-3 min-h-11 rounded-2xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 md:w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06]'
                }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block leading-tight">{tab.label}</span>
                  {tab.desc && (
                    <span className={`hidden md:block text-[11px] font-medium mt-0.5 ${active ? 'text-background/60' : 'text-foreground/40'}`}>
                      {tab.desc}
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </motion.nav>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  </div>
);
