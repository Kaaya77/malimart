import type { ComponentProps } from 'react';
import { SellerMessages } from '../SellerMessages';
import { BuyerMessages } from '../BuyerMessages';
import { AdminMessages } from '../AdminMessages';

export type MessagingHubProps =
  | ComponentProps<typeof SellerMessages>
  | ComponentProps<typeof BuyerMessages>
  | ComponentProps<typeof AdminMessages>;

export const MessagingHub = (props: MessagingHubProps) => {
  if ('setSelectedChatUser' in props) {
    return <SellerMessages {...props} />;
  }

  if ('initialSellerId' in props) {
    return <BuyerMessages {...props} />;
  }

  return <AdminMessages {...props} />;
};
