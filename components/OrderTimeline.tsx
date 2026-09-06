import React from "react";

export type OrderTimelineProps = {
  status: "placed" | "confirmed" | "shipped" | "delivered";
  timestamps?: Partial<Record<"placed" | "confirmed" | "shipped" | "delivered", string>>;
};

const steps = [
  { id: "placed", label: "Placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ status, timestamps = {} }) => {
  const currentIndex = steps.findIndex((s) => s.id === status);

  return (
    <nav aria-label="Order progress" className="order-timeline">
      <ol className="flex items-center gap-4 md:gap-8">
        {steps.map((step, i) => {
          const completed = i <= currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <li key={step.id} className="flex-1">
              <div className="flex items-center md:flex-col md:items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      completed ? "bg-primary text-white" : "bg-gray-200 text-gray-700"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className="text-xs font-semibold">{i + 1}</span>
                  </div>
                  {!isCurrent && <span className="hidden md:inline text-sm">{step.label}</span>}
                </div>

                <div className="mt-2 md:mt-0 md:text-center">
                  {isCurrent && <div className="text-sm font-medium">{step.label}</div>}
                  {timestamps[step.id] ? (
                    <time className="text-xxs text-muted">{timestamps[step.id]}</time>
                  ) : null}
                </div>
              </div>

              {/* connector */}
              {i < steps.length - 1 && (
                <div
                  className={`hidden md:block h-0.5 bg-gradient-to-r from-gray-200 to-gray-300 my-3 ${completed ? "opacity-100" : "opacity-50"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default OrderTimeline;
