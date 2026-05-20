import React from 'react';
import { Share2, MessageCircle, Mail, Instagram, Copy, Check } from 'lucide-react';
import { useToast } from './UI';

interface ShareButtonProps {
    title: string;
    text: string;
    url: string;
    className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, url, className = '' }) => {
    const { addToast } = useToast();
    const [copied, setCopied] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
                addToast('Shared successfully', 'success');
            } catch (err) {
            }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(url);
            setCopied(true);
            addToast('Link copied to clipboard', 'success');
            setTimeout(() => setCopied(false), 2000);
        }
        setIsOpen(false);
    };

    const shareWhatsApp = () => {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title}\n${text}\n${url}`)}`;
        window.open(whatsappUrl, '_blank');
        setIsOpen(false);
    };

    const shareEmail = () => {
        const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
        window.open(emailUrl, '_blank');
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }} 
                className="p-2 hover:bg-foreground/[0.04] rounded-full transition-colors text-foreground"
            >
                <Share2 className="w-4 h-4" />
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-background dark:bg-background border border-foreground/10 shadow-2xl z-50 p-2 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={handleNativeShare} className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.04] rounded-lg text-xs uppercase tracking-widest text-foreground">
                        <Share2 className="w-4 h-4" /> Native Share
                    </button>
                    <button onClick={shareWhatsApp} className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.04] rounded-lg text-xs uppercase tracking-widest text-foreground">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                    </button>
                    <button onClick={shareEmail} className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.04] rounded-lg text-xs uppercase tracking-widest text-foreground">
                        <Mail className="w-4 h-4" /> Email
                    </button>
                    <button onClick={() => {
                        navigator.clipboard.writeText(url);
                        setCopied(true);
                        addToast('Link copied to clipboard', 'success');
                        setTimeout(() => setCopied(false), 2000);
                        setIsOpen(false);
                    }} className="w-full flex items-center gap-3 p-3 hover:bg-foreground/[0.04] rounded-lg text-xs uppercase tracking-widest text-foreground">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy Link
                    </button>
                </div>
            )}
        </div>
    );
};
