import React from "react";

export type OrderTimelineProps = {
  status: "placed" | "confirmed" | "shipped" | "delivered";
  timestamps?: Partial<Record<string, string>>;
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
    <ol className="order-timeline flex gap-4 items-center" aria-label="Order progress">
      {steps.map((step, i) => {
        const completed = i <= currentIndex;
        return (
          <li key={step.id} className={`step flex flex-col items-center text-xs ${completed ? "text-primary" : "text-muted"}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${completed ? "bg-primary text-white" : "bg-gray-200"}`}
              aria-current={i === currentIndex ? "step" : undefined}
            >
              {i + 1}
            </div>
            <div className="mt-2">{step.label}</div>
            {timestamps[step.id] ? <time className="text-xxs text-muted">{timestamps[step.id]}</time> : null}
          </li>
        );
      })}
    </ol>
  );
};

export default OrderTimeline;
