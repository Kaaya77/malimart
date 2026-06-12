import React from 'react';
import { AdminModeration } from '../../components/AdminModeration';
import { motion } from 'framer-motion';
import { useAdmin } from './context';

export const ModerationTab = () => {
    const {  } = useAdmin();
    return (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminModeration />
                            </motion.div>
    );
};
