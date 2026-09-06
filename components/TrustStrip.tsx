import React from "react";

export type TrustStripProps = {
  rating?: { value: number; count: number };
  sellerVerified?: boolean;
  deliveryEstimate?: string;
  returnPolicy?: string;
};

function renderStars(value: number) {
  const rounded = Math.round(value);
  const stars = Array.from({ length: 5 }).map((_, i) => (i < rounded ? "★" : "☆")).join("");
  return stars;
}

export const TrustStrip: React.FC<TrustStripProps> = ({
  rating,
  sellerVerified = false,
  deliveryEstimate,
  returnPolicy,
}) => {
  return (
    <div
      className="trust-strip flex flex-wrap items-center gap-3 text-sm"
      role="region"
      aria-label="Product trust information"
    >
      {rating ? (
        <div className="rating flex items-center gap-2" aria-label={`Rating ${rating.value} of 5`}>
          <span className="stars text-yellow-500" aria-hidden>
            {renderStars(rating.value)}
          </span>
          <span className="text-muted">({rating.count})</span>
        </div>
      ) : null}

      {sellerVerified ? (
        <div className="seller-verified flex items-center" aria-label="Seller verified">
          <span className="badge text-xs bg-green-50 text-green-800 px-2 py-1 rounded">Verified seller</span>
        </div>
      ) : null}

      {deliveryEstimate ? (
        <div className="delivery text-muted" aria-label={`Delivery estimate ${deliveryEstimate}`}>
          <strong className="mr-1">Delivery:</strong>
          <span>{deliveryEstimate}</span>
        </div>
      ) : null}

      {returnPolicy ? (
        <div className="return-policy text-muted" aria-label={`Return policy: ${returnPolicy}`}>
          <strong className="mr-1">Returns:</strong>
          <span>{returnPolicy}</span>
        </div>
      ) : null}
    </div>
  );
};

export default TrustStrip;
