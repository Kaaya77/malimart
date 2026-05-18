import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Heart, Shield, Users } from 'lucide-react';

export const AboutPage = () => {
    return (
        <div className="min-h-screen pt-32 pb-24 px-6">
            <div className="container mx-auto max-w-6xl">
                <div className="mb-16 text-center">
                    <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-tighter mb-6 text-slate-900 dark:text-white">
                        About <span className="text-emerald-500">MaliMart</span>
                    </h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed">
                        We are building the digital bridge between Tanzania's rich heritage of craftsmanship and the global marketplace.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 border border-slate-100 dark:border-white/5 shadow-2xl shadow-slate-200/20 dark:shadow-none"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-8 text-emerald-500">
                            <Globe className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight mb-6 text-slate-900 dark:text-white">Our Mission</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            To empower local artisans, farmers, and creators by providing them with a world-class platform to showcase and sell their authentic Tanzanian products to a global audience.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 border border-slate-100 dark:border-white/5 shadow-2xl shadow-slate-200/20 dark:shadow-none"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-8 text-emerald-500">
                            <Heart className="w-8 h-8" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight mb-6 text-slate-900 dark:text-white">Our Vision</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            To become the premier destination for authentic African goods, fostering sustainable economic growth and preserving cultural heritage through modern commerce.
                        </p>
                    </motion.div>
                </div>

                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black font-display uppercase tracking-tighter mb-4 text-slate-900 dark:text-white">
                        Why Choose Us
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Shield, title: "Verified Sellers", desc: "Every seller on our platform undergoes a rigorous verification process to ensure authenticity." },
                        { icon: Users, title: "Community First", desc: "We prioritize the well-being and growth of our local artisan communities." },
                        { icon: Globe, title: "Nationwide Delivery", desc: "Reliable and fast delivery across all regions of Tanzania." }
                    ].map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-8 text-center border border-slate-100 dark:border-white/5"
                        >
                            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-sm">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-wider mb-4 text-slate-900 dark:text-white">{feature.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
