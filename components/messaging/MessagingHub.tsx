/**
 * MessagingHub — the messaging entry point for all three dashboards.
 *
 * This used to pick between three separate components by SNIFFING PROPS at
 * runtime, through `any`:
 *
 *   const Comp = props.setSelectedChatUser !== undefined ? SellerMessages
 *              : props.initialSellerId !== undefined || props.userId !== undefined
 *                ? BuyerMessages : AdminMessages;
 *
 * — so a buyer who happened to be passed `selectedChatUser` would silently
 * render the seller inbox, and no prop was type-checked at any call site.
 * There is one surface now, and the role is stated rather than inferred.
 */
import { Conversations, MessageContext, MessagingRole } from './Conversations';

export interface MessagingHubProps {
  /** Which inbox this is. Stated by the host page — never inferred. */
  role: MessagingRole;
  /** The signed-in user. */
  userId: string;
  /** Open this conversation on mount (deep link). */
  initialPeerId?: string | null;
  /** Peer display name, when the host page already knows it. */
  initialPeerName?: string | null;
  /** Reference to attach to the first message sent (product / order / return). */
  initialContext?: MessageContext | null;
  /** Told when the open conversation changes, for URL/tab sync. */
  onPeerChange?: (peerId: string | null) => void;
}

export const MessagingHub = (props: MessagingHubProps) => <Conversations {...props} />;

export type { MessageContext, MessagingRole };
