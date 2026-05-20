import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, FileText, Mail, Phone, MapPin } from 'lucide-react';

const CONTENT: Record<string, {
 title: string;
 icon: any;
 sections: { heading: string; body: string }[];
}> = {
 privacy: {
 title: 'Privacy Policy',
 icon: Shield,
 sections: [
 {
 heading: 'Information We Collect',
 body: 'We collect information you provide when you create an account, make purchases, or communicate with sellers. This includes your name, email, phone number, delivery address, and payment transaction records.'
 },
 {
 heading: 'How We Use Your Information',
 body: 'Your information is used to process orders, facilitate communication between buyers and sellers, send order updates, and improve our platform. We do not sell your personal data to third parties.'
 },
 {
 heading: 'Data Security',
 body: 'MaliMart employs industry-standard security measures including SSL encryption, secure payment processing, and regular security audits to protect your data.'
 },
 {
 heading: 'Cookies',
 body: 'We use cookies to maintain your session, remember your preferences, and analyze platform usage. You may disable cookies in your browser settings, though some features may be affected.'
 },
 {
 heading: 'Your Rights',
 body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting our support team. We will respond to all legitimate requests within 30 days.'
 },
 {
 heading: 'Contact',
 body: 'For privacy-related questions, contact us at privacy@malimart.tz or write to MaliMart Ltd., Dar es Salaam, Tanzania.'
 },
 ]
 },
 terms: {
 title: 'Terms of Service',
 icon: FileText,
 sections: [
 {
 heading: 'Acceptance of Terms',
 body: 'By accessing or using MaliMart, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.'
 },
 {
 heading: 'User Accounts',
 body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to create an account.'
 },
 {
 heading: 'Seller Responsibilities',
 body: 'Sellers are responsible for accurately describing their products, fulfilling orders promptly, and maintaining fair pricing. Fraudulent listings or misrepresentation will result in account suspension.'
 },
 {
 heading: 'Buyer Responsibilities',
 body: 'Buyers agree to pay for purchases made, provide accurate delivery information, and communicate respectfully with sellers. Returns must comply with each seller\'s stated return policy.'
 },
 {
 heading: 'Platform Fees',
 body: 'MaliMart charges a service fee on successful transactions. Current fee structures are available in your seller dashboard. We reserve the right to update fees with 30 days notice.'
 },
 {
 heading: 'Dispute Resolution',
 body: 'In case of disputes between buyers and sellers, MaliMart will mediate. Unresolved disputes may be subject to arbitration under Tanzanian law. Contact support@malimart.tz.'
 },
 {
 heading: 'Limitation of Liability',
 body: 'MaliMart acts as a marketplace intermediary and is not liable for product quality, seller performance, or losses arising from transactions. We provide tools but do not guarantee outcomes.'
 },
 ]
 },
 contact: {
 title: 'Contact Us',
 icon: Mail,
 sections: [
 {
 heading: 'Customer Support',
 body: 'Our support team is available Monday–Friday, 8:00 AM – 6:00 PM EAT. We aim to respond to all inquiries within 24 hours.'
 },
 {
 heading: 'Email',
 body: 'support@malimart.tz — for general support and account issues\nsellers@malimart.tz — for seller onboarding and merchant support\nprivacy@malimart.tz — for data and privacy inquiries'
 },
 {
 heading: 'Phone',
 body: '+255 XXX XXX XXX — available during business hours'
 },
 {
 heading: 'Office',
 body: 'MaliMart Ltd.\nDar es Salaam, Tanzania\nUnited Republic of Tanzania'
 },
 {
 heading: 'Report an Issue',
 body: 'To report a fraudulent listing, buyer/seller dispute, or safety concern, please email safety@malimart.tz with your order ID and a description of the issue.'
 },
 ]
 }
};

export const StaticPage: React.FC = () => {
 const location = useLocation();
 const slug = location.pathname.replace('/', '');
 const page = CONTENT[slug] || CONTENT['terms'];
 const Icon = page.icon;

 return (
 <div className="min-h-screen bg-background pt-24 md:pt-28 pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans">
 <div className="container mx-auto max-w-2xl px-4 md:px-8">
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
 >
 {/* Header */}
 <div className="flex items-center gap-4 mb-10">
 <div className="w-12 h-12 rounded-2xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
 <Icon className="w-5 h-5 text-foreground/70 stroke-[2]" />
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-foreground/40 mb-0.5">MaliMart</p>
 <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{page.title}</h1>
 </div>
 </div>

 {/* Sections */}
 <div className="space-y-8">
 {page.sections.map((section, i) => (
 <motion.div
 key={i}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, delay: i * 0.05 }}
 className="border-l-2 border-foreground/10 pl-5"
 >
 <h2 className="font-semibold text-foreground mb-2 text-[15px]">{section.heading}</h2>
 <p className="text-sm text-foreground/60 leading-relaxed whitespace-pre-line">{section.body}</p>
 </motion.div>
 ))}
 </div>

 <div className="mt-12 pt-6 border-t border-foreground/8 text-[11px] text-foreground/35">
 Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
 </div>
 </motion.div>
 </div>
 </div>
 );
};

export default StaticPage;
