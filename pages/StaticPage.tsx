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
 heading: 'Who We Are',
 body: 'MaliMart ("we", "us") operates an online multi-vendor marketplace connecting buyers and sellers in Tanzania. For the purposes of the Personal Data Protection Act, 2022 (PDPA) and its Regulations, MaliMart is the data controller of personal data processed through this platform. This policy explains what we collect, why, how long we keep it, and the rights you have.'
 },
 {
 heading: 'Information We Collect',
 body: 'When you create an account, buy, sell, or contact us, we collect: identity data (name, display name), contact data (email, phone number), delivery data (addresses, region), transaction data (orders, payments processed via licensed payment providers, refunds and disputes), content you submit (product listings, reviews, messages, photos), and technical data (device type, approximate location, usage logs) needed to keep the platform secure and functional. We do not collect more than is necessary for these purposes.'
 },
 {
 heading: 'How and Why We Use Your Information',
 body: 'We process personal data to: create and manage your account; process orders and payments; facilitate delivery and communication between buyers and sellers; prevent fraud and enforce our Terms; comply with legal obligations (including tax and consumer protection laws); and improve the platform. Our lawful bases under the PDPA include performance of a contract with you, compliance with legal obligations, your consent where required, and our legitimate interest in operating a safe marketplace. We do not sell your personal data.'
 },
 {
 heading: 'Where Your Data Is Stored (Cross-Border Transfers)',
 body: 'Our platform is hosted on cloud infrastructure whose servers may be located outside the United Republic of Tanzania. By creating an account you acknowledge and consent to your personal data being transferred to and stored on such infrastructure, subject to safeguards consistent with the PDPA, including encryption in transit and at rest and contractual data-protection commitments from our hosting providers. Where the law requires additional measures for cross-border transfer, we will implement them.'
 },
 {
 heading: 'Sharing Your Information',
 body: 'We share data only as needed to run the marketplace: with the seller or buyer on the other side of your transaction (name, delivery details, order contents); with licensed payment service providers to process payments; with delivery partners you select; and with public authorities where the law requires it. Each recipient receives only what is necessary for their role.'
 },
 {
 heading: 'Data Retention',
 body: 'We keep account data for as long as your account is active. Transaction records are retained for a minimum of five (5) years to meet tax and accounting obligations under Tanzanian law. Messages and reviews are retained while relevant to the service. When data is no longer needed, it is deleted or anonymised.'
 },
 {
 heading: 'Data Security',
 body: 'We apply appropriate technical and organisational measures as required by the PDPA, including encrypted connections (HTTPS), access controls, row-level database security, and payment processing exclusively through providers licensed by the Bank of Tanzania. No system is perfectly secure; if we become aware of a breach affecting your data, we will notify you and the Personal Data Protection Commission as required by law.'
 },
 {
 heading: 'Your Rights',
 body: 'Under the PDPA you have the right to access your personal data, request correction of inaccurate data, request deletion where retention is no longer justified, object to certain processing, and withdraw consent where processing is based on consent. To exercise any of these rights, contact us using the details below. We respond to legitimate requests within 30 days. You also have the right to lodge a complaint with the Personal Data Protection Commission (PDPC).'
 },
 {
 heading: 'Cookies and Local Storage',
 body: 'We use strictly necessary cookies and local storage to keep you signed in, remember preferences, and operate the app (including offline features). Disabling them in your browser may stop parts of the platform from working.'
 },
 {
 heading: 'Children',
 body: 'MaliMart is not directed at persons under 18, and we do not knowingly collect personal data from children. Accounts may only be created by persons aged 18 or older.'
 },
 {
 heading: 'Changes and Contact',
 body: 'We may update this policy as the platform or the law evolves; material changes will be announced in-app. For privacy questions or to exercise your rights, contact: privacy@malimart.co.tz, MaliMart, Dar es Salaam, Tanzania. Last updated: June 2026.'
 },
 ]
 },
 terms: {
 title: 'Terms of Service',
 icon: FileText,
 sections: [
 {
 heading: '1. Who We Are and What MaliMart Is',
 body: 'MaliMart is an online marketplace that connects independent sellers with buyers in Tanzania. MaliMart is an intermediary: unless expressly stated, MaliMart is not the seller of the products listed, does not own the inventory, and is not a party to the sale contract, which is formed directly between the buyer and the seller. By using the platform you agree to these Terms; if you do not agree, do not use MaliMart.'
 },
 {
 heading: '2. Accounts and Eligibility',
 body: 'You must be at least 18 years old and capable of entering into a binding contract under Tanzanian law. You are responsible for the accuracy of your account information and for all activity under your credentials. Notify us immediately of any unauthorised use. We may suspend or terminate accounts that breach these Terms, applicable law, or the trust of the marketplace.'
 },
 {
 heading: '3. Orders, Pricing and Payment',
 body: 'All prices are in Tanzanian Shillings (TZS) unless stated otherwise. An order becomes binding when confirmed by the platform. Payments are processed exclusively through payment service providers licensed by the Bank of Tanzania; MaliMart does not store your mobile money PIN or full payment credentials. An order is treated as paid only after the payment provider confirms receipt of funds. Sellers set their own prices; obvious pricing errors may result in cancellation with a full refund.'
 },
 {
 heading: '4. Delivery and Risk',
 body: 'Delivery timelines are estimates provided by sellers. Risk in the goods passes to the buyer on delivery. Buyers must provide accurate delivery information; sellers must dispatch within the time stated on the listing or notify the buyer of delays.'
 },
 {
 heading: '5. Returns, Refunds and Disputes',
 body: 'Returns and refunds are governed by our Returns Policy, which forms part of these Terms. If a buyer and seller cannot resolve an issue, either party may open a dispute in-app; MaliMart will review the evidence and make a determination in good faith, which both parties agree to accept as the platform-level resolution, without prejudice to their rights under Tanzanian consumer protection law.'
 },
 {
 heading: '6. Acceptable Use and Prohibited Items',
 body: 'You may not list or trade: counterfeit or stolen goods; weapons or ammunition; illegal drugs or controlled substances without licence; wildlife products prohibited by law; or any item whose sale violates the laws of Tanzania. You may not use the platform for fraud, money laundering, harassment, scraping, or interference with its operation. We may remove listings and report unlawful conduct to authorities.'
 },
 {
 heading: '7. Content and Intellectual Property',
 body: 'You retain ownership of content you post (listings, photos, reviews) and grant MaliMart a non-exclusive, royalty-free licence to host, display and promote it on and in connection with the platform. You warrant your content does not infringe third-party rights. The MaliMart name, logo and platform software are our property; nothing in these Terms transfers them to you.'
 },
 {
 heading: '8. Liability',
 body: 'MaliMart provides the platform "as is". To the maximum extent permitted by Tanzanian law, MaliMart is not liable for the quality, safety or legality of items listed by sellers, the accuracy of listings, or the ability of buyers to pay or sellers to deliver. Nothing in these Terms excludes liability that cannot be excluded by law, including statutory consumer rights under the Fair Competition Act.'
 },
 {
 heading: '9. Electronic Transactions',
 body: 'In accordance with the Electronic Transactions Act, 2015, you agree that contracts may be concluded electronically through the platform, and that electronic records and receipts issued by the platform are valid evidence of the transactions they record.'
 },
 {
 heading: '10. Governing Law and Changes',
 body: 'These Terms are governed by the laws of the United Republic of Tanzania, and the courts of Tanzania have jurisdiction over disputes that are not resolved through the platform. We may update these Terms; continued use after an announced update constitutes acceptance. Last updated: June 2026.'
 },
 ]
 },
 'seller-agreement': {
 title: 'Seller Agreement',
 icon: FileText,
 sections: [
 {
 heading: '1. Relationship',
 body: 'This Agreement governs your use of MaliMart as a seller. You sell in your own name and on your own account; MaliMart provides the marketplace, payment facilitation through licensed providers, and promotional tools. Nothing here creates an employment, agency or partnership relationship.'
 },
 {
 heading: '2. Seller Verification (KYC)',
 body: 'Before or shortly after onboarding, you must provide accurate identification: full legal name or registered business name, a valid government-issued ID or certificate of incorporation, a working phone number, and your TIN where applicable. We may suspend payouts or listings until verification is complete, and may re-verify periodically.'
 },
 {
 heading: '3. Listings and Conduct',
 body: 'You are solely responsible for the accuracy of your listings: descriptions, photos, prices, stock levels and delivery times must be truthful and kept current. You must not list prohibited items (see Terms of Service §6), infringe intellectual property, manipulate reviews, or contact buyers to complete sales off-platform to avoid fees.'
 },
 {
 heading: '4. Orders and Fulfilment',
 body: 'You must confirm or decline orders promptly and dispatch within the time stated on your listing. Repeated cancellations, late dispatch or misdescribed goods may lead to listing demotion, suspension, or termination. You are responsible for complying with any licensing requirements applicable to the goods you sell.'
 },
 {
 heading: '5. Fees, Payouts and Taxes',
 body: 'MaliMart charges a commission on completed sales at the rate published in your seller dashboard at the time of sale; the rate may change with at least 14 days notice. Payouts of your sales proceeds, less commission and any refunds, are made to your designated mobile money or bank account on the published payout schedule. You are responsible for your own tax obligations, including income tax, VAT where registered, and issuing fiscal receipts as required by the Tanzania Revenue Authority.'
 },
 {
 heading: '6. Returns, Refunds and Disputes',
 body: 'You agree to honour the platform Returns Policy. Where a dispute is decided against you, the refund amount may be deducted from your pending payouts. Persistent disputes may trigger account review.'
 },
 {
 heading: '7. Data Protection',
 body: 'Buyer personal data you receive (names, phone numbers, addresses) may be used only to fulfil the specific order. Using buyer data for marketing, selling it, or retaining it beyond what fulfilment requires violates this Agreement and the Personal Data Protection Act, 2022, and will result in termination and may be reported to the Personal Data Protection Commission.'
 },
 {
 heading: '8. Suspension and Termination',
 body: 'Either party may end this Agreement at any time; obligations relating to open orders, refunds, fees and data protection survive termination. We may suspend immediately for fraud, prohibited items, or legal risk, and will state the reason where the law permits.'
 },
 {
 heading: '9. General',
 body: 'This Agreement is governed by the laws of the United Republic of Tanzania and supplements the Terms of Service, which also apply to you. Last updated: June 2026.'
 },
 ]
 },
 returns: {
 title: 'Returns & Refunds Policy',
 icon: Shield,
 sections: [
 {
 heading: 'Our Promise',
 body: 'We want you to buy with confidence. This policy explains when you can return an item, how refunds work, and what to do when something goes wrong. It applies to all purchases on MaliMart and is part of our Terms of Service.'
 },
 {
 heading: 'When You Can Return an Item',
 body: 'You may request a return within seven (7) days of delivery if the item is: significantly different from its description or photos; defective, damaged on arrival, or not working; the wrong item, size or quantity; or counterfeit. Open a return request from your Orders page with photos of the issue — clear evidence speeds everything up.'
 },
 {
 heading: 'What Cannot Be Returned',
 body: 'Unless faulty or misdescribed, the following cannot be returned for change of mind: perishable goods (food, flowers), personal care items that have been opened, underwear and swimwear, custom-made or personalised items, and digital goods once delivered. Statutory rights for defective goods under the Fair Competition Act are not affected.'
 },
 {
 heading: 'How the Process Works',
 body: 'Step 1: Open a return request within 7 days of delivery, with photos and a short description. Step 2: The seller has 48 hours to respond — accept, propose a solution, or contest. Step 3: If you and the seller cannot agree, MaliMart reviews the evidence and decides within 5 business days. Step 4: If a return is approved, follow the return shipping instructions provided; once the seller confirms receipt (or 7 days pass without objection), your refund is processed.'
 },
 {
 heading: 'Refunds',
 body: 'Approved refunds are issued to the mobile money number or payment method used for the purchase, normally within 3–7 business days of approval. Where the item was misdescribed, defective or wrong, the seller bears the return delivery cost; for agreed change-of-mind returns, the buyer bears it unless the seller offers otherwise.'
 },
 {
 heading: 'Items That Never Arrive',
 body: 'If your order does not arrive within the estimated delivery window, contact the seller via Messages first. If there is no resolution within 48 hours, open a dispute — orders confirmed as undelivered are refunded in full.'
 },
 {
 heading: 'Abuse',
 body: 'Return fraud — returning different items, false damage claims, or serial abuse of this policy — leads to account suspension. We protect honest buyers and honest sellers equally. Last updated: June 2026.'
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
