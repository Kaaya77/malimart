import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { SellerMessages } from '../components/SellerMessages';

export const MessagesPage = () => {
    const { user, products } = useAppState();
    const [searchParams] = useSearchParams();
    const [selectedChatUser, setSelectedChatUser] = useState<string | null>(searchParams.get('chat'));

    return (
        <div className="min-h-screen pt-32 pb-24 px-6">
            <div className="container mx-auto max-w-6xl">
                <div className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-black font-display uppercase tracking-tighter mb-4 text-foreground">
                        Your <span className="text-emerald-500">Messages</span>
                    </h1>
                    <p className="text-muted-foreground font-medium max-w-2xl">
                        Communicate directly with {user?.role === 'seller' ? 'buyers' : 'sellers'} regarding products, orders, and inquiries.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-3xl p-6 md:p-8 border border-foreground/8 min-h-[600px]"
                >
                    {user ? (
                        <SellerMessages 
                            userId={user.id} 
                            selectedChatUser={selectedChatUser} 
                            setSelectedChatUser={setSelectedChatUser} 
                            products={products} 
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-24">
                            <div className="w-24 h-24 rounded-full bg-foreground/8 flex items-center justify-center mb-6">
                                <MessageSquare className="w-10 h-10 text-foreground/40" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-widest text-foreground mb-4">
                                Sign in to view messages
                            </h3>
                            <p className="text-muted-foreground max-w-md">
                                You need to be logged in to communicate with other users on MaliMart.
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};
