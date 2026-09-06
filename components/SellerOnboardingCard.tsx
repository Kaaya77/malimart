import React from "react";

export const SellerOnboardingCard: React.FC = () => {
  // TODO: wire real progress from backend/account API
  const steps = [
    { id: "add-product", label: "Add first product", done: false },
    { id: "delivery-zones", label: "Set delivery zones", done: false },
    { id: "payout", label: "Add payout method", done: false },
    { id: "verify", label: "Verify store", done: false },
    { id: "policies", label: "Add store policies", done: false },
    { id: "branding", label: "Add store branding", done: false },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <section className="seller-onboarding p-4 border rounded" aria-label="Seller onboarding checklist">
      <header className="flex items-center justify-between">
        <h3 className="text-lg">Get your store ready</h3>
        <div className="progress-ring" aria-hidden>
          {/* Placeholder ring */}
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">{completed}/6</div>
        </div>
      </header>

      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center justify-between">
            <div>
              <strong>{s.label}</strong>
              <div className="text-xxs text-muted">{s.done ? "Done" : "Not started"}</div>
            </div>
            <div>
              <button className="btn btn-sm">Continue</button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xxs text-muted">This is a starter scaffold — integrate with seller account API to persist progress.</p>
    </section>
  );
};

export default SellerOnboardingCard;
