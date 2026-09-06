import React from "react";

export type TrustStripProps = {
  rating?: { value: number; count: number };
  sellerVerified?: boolean;
  deliveryEstimate?: string;
  returnPolicy?: string;
};

export const TrustStrip: React.FC<TrustStripProps> = ({
  rating,
  sellerVerified = false,
  deliveryEstimate,
  returnPolicy,
}) => {
  return (
    <div className="trust-strip flex items-center gap-4 text-sm" role="region" aria-label="Product trust information">
      {rating ? (
        <div className="rating flex items-center" aria-label={`Rating ${rating.value} of 5`}>
          <span className="stars" aria-hidden>
            {"★".repeat(Math.round(rating.value))}{"☆".repeat(5 - Math.round(rating.value))}
          </span>
          <span className="ml-2 text-muted">({rating.count})</span>
        </div>
      ) : null}

      {sellerVerified ? (
        <div className="seller-verified flex items-center" aria-label="Seller verified">
          <span className="badge text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Verified seller</span>
        </div>
      ) : null}

      {deliveryEstimate ? (
        <div className="delivery text-muted" aria-label={`Delivery estimate ${deliveryEstimate}`}>
          {deliveryEstimate}
        </div>
      ) : null}

      {returnPolicy ? (
        <div className="return-policy text-muted" aria-label={`Return policy: ${returnPolicy}`}>
          {returnPolicy}
        </div>
      ) : null}
    </div>
  );
};

export default TrustStrip;
