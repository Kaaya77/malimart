import { SellerMessages } from '../SellerMessages';
import { BuyerMessages } from '../BuyerMessages';
import { AdminMessages } from '../AdminMessages';

// Lightweight runtime router for the three messaging surfaces.
// Use `any` here intentionally to avoid fragile prop-union inference
// across three large component prop types.
export const MessagingHub = (props: any) => {
  // SellerMessages expects a `setSelectedChatUser` callback prop
  if (props && typeof props.setSelectedChatUser !== 'undefined') {
    return <SellerMessages {...props} />;
  }

  // BuyerMessages expects `initialSellerId` or a `userId` to operate
  if (props && (typeof props.initialSellerId !== 'undefined' || typeof props.userId !== 'undefined')) {
    return <BuyerMessages {...props} />;
  }

  // Fallback to admin surface
  return <AdminMessages {...props} />;
};
