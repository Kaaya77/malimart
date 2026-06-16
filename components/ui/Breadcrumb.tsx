import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb = ({ items, className = '' }: BreadcrumbProps) => (
  <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-xs font-semibold text-foreground/50 ${className}`}>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-foreground/30" />}
        {item.href && i < items.length - 1 ? (
          <a href={item.href} className="hover:text-foreground transition-colors">
            {item.label}
          </a>
        ) : (
          <span className={i === items.length - 1 ? 'text-foreground/80' : ''}>{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);
