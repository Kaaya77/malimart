import React, { useEffect, useState } from "react";

const STEPS = [
  { id: "add-product", label: "Add first product", href: "/seller/products/new" },
  { id: "delivery-zones", label: "Set delivery zones", href: "/seller/delivery" },
  { id: "payout", label: "Add payout method", href: "/seller/payout" },
  { id: "verify", label: "Verify store", href: "/seller/verify" },
  { id: "policies", label: "Add store policies", href: "/seller/policies" },
  { id: "branding", label: "Add store branding", href: "/seller/branding" },
];

const STORAGE_KEY = "malimart_seller_onboarding_v1";

export const SellerOnboardingCard: React.FC = () => {
  const [doneSet, setDoneSet] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDoneSet(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doneSet));
    } catch (e) {
      // ignore
    }
  }, [doneSet]);

  const toggle = (id: string) => {
    setDoneSet((s) => ({ ...s, [id]: !s[id] }));
  };

  const completed = STEPS.filter((s) => doneSet[s.id]).length;

  return (
    <section className="seller-onboarding p-4 border rounded bg-white">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Get your store ready</h3>
          <p className="text-xxs text-muted">Complete the steps below to start selling.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white flex items-center justify-center">
            <span className="text-sm font-bold">{Math.round((completed / STEPS.length) * 100)}%</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{completed}/{STEPS.length} done</div>
            <div className="text-xxs text-muted">Keep going — add your first product</div>
          </div>
        </div>
      </header>

      <ul className="mt-4 space-y-3">
        {STEPS.map((s) => (
          <li key={s.id} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <input
                  id={`onboard-${s.id}`}
                  type="checkbox"
                  checked={!!doneSet[s.id]}
                  onChange={() => toggle(s.id)}
                  aria-label={`${s.label} completed`}
                />
                <label htmlFor={`onboard-${s.id}`} className="font-medium ml-2">
                  {s.label}
                </label>
              </div>
              <div className="text-xxs text-muted">{doneSet[s.id] ? "Completed" : "Not started"}</div>
            </div>

            <div className="flex items-center gap-2">
              <a href={s.href} className="btn btn-sm" aria-label={`Go to ${s.label}`}>
                Continue
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xxs text-muted">Progress is stored locally for this scaffold — replace with server-side persistence when wiring to the account API.</p>
    </section>
  );
};

export default SellerOnboardingCard;
