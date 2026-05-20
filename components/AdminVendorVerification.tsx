import React, { useState } from 'react';
import { Card, Button, Badge, Modal } from './UI';
import { supabase } from '../services/supabaseClient';
import { FileText, MessageSquare, CheckCircle, XCircle, History, ShieldCheck } from 'lucide-react';

export const AdminVendorVerification = ({ vendor, onUpdate, onMessage }: { vendor: any, onUpdate: () => Promise<void> | void, onMessage: (userId: string, userName: string, context?: any) => void, key?: string }) => {
 const [showDocs, setShowDocs] = useState(false);

 const handleVerify = async (approve: boolean) => {
 await supabase.from('vendor_profiles').update({ is_verified: approve }).eq('seller_id', vendor.seller_id);
 onUpdate();
 };

 return (
 <>
 <Card className="p-8 rounded-3xl bg-card border border-foreground/8 shadow-sm group hover:shadow-md transition-all duration-300 space-y-8">
 <div className="flex justify-between items-start">
 <div className="space-y-1">
 <h3 className="font-sans font-bold text-xl text-foreground leading-tight tracking-tight">{vendor.store_name}</h3>
 <p className="text-[10px] uppercase font-bold text-foreground/50 tracking-wider">Vendor Application</p>
 </div>
 <Badge variant={vendor.is_verified ? 'secondary' : 'outline'} className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider">
 {vendor.is_verified ? 'Verified' : 'Pending Review'}
 </Badge>
 </div>
 
 {/* Progress Bar */}
 <div className="space-y-2">
 <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-foreground/50">
 <span>Verification Progress</span>
 <span>{vendor.is_verified ? '100%' : '65%'}</span>
 </div>
 <div className="w-full bg-foreground/[0.06] h-2 rounded-full overflow-hidden border border-foreground/8">
 <div 
 className={`h-full transition-all duration-1000 ease-out ${vendor.is_verified ? 'bg-primary w-full' : 'bg-primary/50 w-[65%]'}`}
 />
 </div>
 </div>
 
 {/* Checklist */}
 <div className="grid grid-cols-1 gap-4 py-6 border-y border-foreground/8">
 <div className="flex items-center justify-between group/item">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
 <CheckCircle className="w-4 h-4 text-primary stroke-2" />
 </div>
 <span className="text-xs font-bold text-foreground">Business Registration</span>
 </div>
 <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Verified</span>
 </div>
 <div className="flex items-center justify-between group/item">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
 <CheckCircle className="w-4 h-4 text-primary stroke-2" />
 </div>
 <span className="text-xs font-bold text-foreground">Tax Identification (TIN)</span>
 </div>
 <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Verified</span>
 </div>
 <div className="flex items-center justify-between group/item">
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${vendor.is_verified ? 'bg-primary/10' : 'bg-foreground/[0.06]'}`}>
 {vendor.is_verified ? (
 <CheckCircle className="w-4 h-4 text-primary stroke-2" />
 ) : (
 <History className="w-4 h-4 text-foreground/50 stroke-2" />
 )}
 </div>
 <span className="text-xs font-bold text-foreground">Bank Account Details</span>
 </div>
 <span className={`text-[10px] font-bold uppercase tracking-wider ${vendor.is_verified ? 'text-primary' : 'text-foreground/50'}`}>
 {vendor.is_verified ? 'Verified' : 'In Review'}
 </span>
 </div>
 </div>

 <div className="flex gap-3">
 <Button variant="outline" className="h-12 rounded-xl text-xs font-bold flex-1 shadow-sm" onClick={() => setShowDocs(!showDocs)}>
 <FileText className="w-4 h-4 mr-2" /> View Documents
 </Button>
 <Button variant="outline" className="h-12 rounded-xl text-xs font-bold flex-1 shadow-sm" onClick={() => onMessage(vendor.seller_id, vendor.store_name, { type: 'support', label: 'Vendor Verification', id: vendor.seller_id })}>
 <MessageSquare className="w-4 h-4 mr-2" /> Message Vendor
 </Button>
 </div>

 <div className="flex gap-3 pt-4">
 {vendor.is_verified ? (
 <Button variant="outline" className="h-12 rounded-xl text-xs font-bold flex-1 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm" onClick={() => handleVerify(false)}>
 Revoke Verification
 </Button>
 ) : (
 <>
 <Button variant="outline" className="h-12 rounded-xl text-xs font-bold flex-1 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm" onClick={() => handleVerify(false)}>
 Reject
 </Button>
 <Button className="h-12 rounded-xl text-xs font-bold flex-1 shadow-sm" onClick={() => handleVerify(true)}>
 Approve
 </Button>
 </>
 )}
 </div>
 </Card>

 <Modal isOpen={showDocs} title={`Verification Documents: ${vendor.store_name}`} onClose={() => setShowDocs(false)}>
 <div className="p-8 space-y-6">
 <div className="space-y-4">
 {[
 { label: 'Business Registration', url: vendor.business_reg_url },
 { label: 'TIN Certificate', url: vendor.tin_url },
 { label: 'ID Scan', url: vendor.id_scan_url }
 ].map((doc, idx) => (
 <div key={idx} className="p-4 rounded-xl bg-card border border-foreground/8 shadow-sm flex items-center justify-between">
 <div className="flex items-center gap-3">
 <FileText className="w-5 h-5 text-foreground/50 stroke-2" />
 <span className="text-sm font-bold text-foreground">{doc.label}</span>
 </div>
 {doc.url ? (
 <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
 Open File
 </a>
 ) : (
 <span className="text-xs font-bold text-foreground/50">Not Uploaded</span>
 )}
 </div>
 ))}
 </div>
 <Button className="w-full h-12 rounded-xl text-xs font-bold shadow-sm" onClick={() => setShowDocs(false)}>
 Close
 </Button>
 </div>
 </Modal>
 </>
 );
};
