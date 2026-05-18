import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export const BannedPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-md"
            >
                <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6" />
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Account Banned</h1>
                <p className="text-slate-400 mb-8">
                    Your account has been banned due to a violation of our terms of service. 
                    If you believe this is a mistake, please contact support.
                </p>
            </motion.div>
        </div>
    );
};
