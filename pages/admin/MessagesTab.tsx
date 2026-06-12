import React from 'react';
import { AdminMessages } from '../../components/AdminMessages';
import { motion } from 'framer-motion';
import { useAdmin } from './context';

export const MessagesTab = () => {
    const { selectedMessageUser } = useAdmin();
    return (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminMessages initialSelectedUser={selectedMessageUser} />
                            </motion.div>
    );
};
