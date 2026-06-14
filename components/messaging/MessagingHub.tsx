import React from 'react';
import { SellerMessages } from '../SellerMessages';
import { BuyerMessages } from '../BuyerMessages';
import { AdminMessages } from '../AdminMessages';

// Lightweight runtime router for the three messaging surfaces.
// Use `any` here intentionally to avoid fragile prop-union inference
// across three large component prop types.
export const MessagingHub = (props: any) => {
  const Comp: any = (props && typeof props.setSelectedChatUser !== 'undefined')
    ? SellerMessages
    : (props && (typeof props.initialSellerId !== 'undefined' || typeof props.userId !== 'undefined'))
      ? BuyerMessages
      : AdminMessages;

  return React.createElement(Comp, props as any);
};
