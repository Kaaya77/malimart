import React from "react";

export const CartSkeleton: React.FC = () => {
  return (
    <div className="cart-skeleton space-y-4" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded" />
          <div className="flex-1 space-y-2">
            <div className="w-3/4 h-4 bg-gray-200 rounded" />
            <div className="w-1/2 h-4 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CartSkeleton;
