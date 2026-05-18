import React, { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { Button, Textarea, Modal } from './UI';

export const SendMessageModal = ({ isOpen, onClose, sellerId, sellerName }: { isOpen: boolean, onClose: () => void, sellerId: string, sellerName: string }) => {
    const { sendMessage } = useAppState();
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        setIsLoading(true);
        await sendMessage(sellerId, message);
        setIsLoading(false);
        onClose();
        setMessage('');
    };

    return (
        <Modal isOpen={isOpen} title={`Message ${sellerName}`} onClose={onClose}>
            <div className="space-y-4">
                <Textarea value={message} onChange={(e: any) => setMessage(e.target.value)} placeholder="Type your message here..." />
                <Button onClick={handleSend} isLoading={isLoading} className="w-full">Send Message</Button>
            </div>
        </Modal>
    );
};
