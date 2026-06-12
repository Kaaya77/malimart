import React, { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Lock } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { SellerMessages } from '../components/SellerMessages';
import { BuyerMessages } from '../components/BuyerMessages';
import { Link } from 'react-router-dom';

export const MessagesPage = () => {
  const { user, products } = useAppState();
  const [searchParams] = useSearchParams();
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(searchParams.get('chat'));

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ paddingTop: 'max(72px, env(safe-area-inset-top) + 56px)' }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-full bg-foreground/[0.05] flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-foreground/20" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Sign in Required</h3>
          <p className="text-sm text-foreground/40 font-medium mb-6">Log in to view your messages and communicate with other users.</p>
          <Link to="/login?redirect=/messages"
            className="inline-flex h-11 px-6 items-center justify-center bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">
            Sign In
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans" style={{ paddingTop: 'max(72px, env(safe-area-inset-top) + 56px)' }}>
      <div className="max-w-6xl mx-auto px-4 pb-8 pt-6 md:pt-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="text-sm text-foreground/45 mt-1">
            {user.role === 'seller' ? 'Conversations with your buyers' : user.role === 'admin' ? 'Conversations across the marketplace' : 'Conversations with sellers about products and orders'}
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-background border border-foreground/10 rounded-2xl overflow-hidden"
          style={{ height: 'calc(100dvh - 200px)', minHeight: '500px' }}
        >
          {user.role === 'buyer' ? (
            <BuyerMessages
              userId={user.id}
              initialSellerId={selectedChatUser}
            />
          ) : (
            <SellerMessages
              userId={user.id}
              selectedChatUser={selectedChatUser}
              setSelectedChatUser={setSelectedChatUser}
              products={products}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};
