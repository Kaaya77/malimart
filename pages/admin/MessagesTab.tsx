import React from 'react';
import { MessagingHub } from '../../components/messaging/MessagingHub';
import { motion } from 'framer-motion';
import { useAdmin } from './context';

export const MessagesTab = () => {
    const { selectedMessageUser } = useAdmin();
    return (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <MessagingHub initialSelectedUser={selectedMessageUser} />
                            </motion.div>
    );
};
