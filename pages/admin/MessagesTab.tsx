import { MessagingHub, MessageContext } from '../../components/messaging/MessagingHub';
import { motion } from 'framer-motion';
import { useAdmin } from './context';
import { useAppState } from '../../context/AppContext';

export const MessagesTab = () => {
    const { selectedMessageUser } = useAdmin();
    const { user } = useAppState();
    if (!user) return null;

    // The admin dashboard hands over a peer plus the order/return being
    // discussed; 'support' carries no record to attach, so it opens the
    // conversation without a reference.
    const ctx = selectedMessageUser?.context;
    const context: MessageContext | null =
        ctx && (ctx.type === 'order' || ctx.type === 'return')
            ? { type: ctx.type, id: ctx.id, label: ctx.label }
            : null;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <MessagingHub
                role="admin"
                userId={user.id}
                initialPeerId={selectedMessageUser?.id ?? null}
                initialPeerName={selectedMessageUser?.name ?? null}
                initialContext={context}
            />
        </motion.div>
    );
};
