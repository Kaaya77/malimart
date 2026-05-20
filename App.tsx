import React, { ReactNode, useEffect, useState, PropsWithChildren, Suspense, lazy } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { 
  Twitter, Github, Youtube, Figma, MapPin, Phone, Mail, Loader2, 
  ArrowUpRight, ArrowRight, Instagram, Linkedin, ShieldCheck, Globe, Zap,
  Facebook, CreditCard, Wallet, ChevronUp, CheckCircle2, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppStateProvider, useAppState } from './context/AppContext';
import { SocketProvider } from './src/context/SocketContext';
import { ToastProvider, ErrorBoundary, Button, Input } from './components/UI';
import { Navbar, MobileBottomNav } from './components/Navbar';
import { Footer } from './components/Footer';
import { AIChatAssistant } from './components/AIChatAssistant';
import { Magnetic } from './components/Effects';

// Lazy Page Imports
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const SellerPage = lazy(() => import('./pages/SellerPage').then(m => ({ default: m.SellerPage })));
const BuyerPage = lazy(() => import('./pages/BuyerPage').then(m => ({ default: m.BuyerPage })));
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })));
const LoginPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.LoginPage })));
const StorePage = lazy(() => import('./pages/StorePage').then(m => ({ default: m.StorePage })));
const ProductPage = lazy(() => import('./pages/ProductPage').then(m => ({ default: m.ProductPage })));
const NotFound = lazy(() => import('./components/NotFound').then(m => ({ default: m.NotFound })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then(m => ({ default: m.OrderConfirmationPage })));
const SellerSettingsPage = lazy(() => import('./pages/SellerSettingsPage').then(m => ({ default: m.SellerSettingsPage })));
const BuyerSettingsPage = lazy(() => import('./pages/BuyerSettingsPage').then(m => ({ default: m.BuyerSettingsPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

// --- SCROLL TO TOP COMPONENT ---
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

// --- ROUTE GUARD COMPONENT ---
interface RouteGuardProps {
  requiredRole?: 'seller' | 'buyer' | 'admin';
}

const RouteGuard = ({ children, requiredRole }: PropsWithChildren<RouteGuardProps>) => {
  const { user, isLoading } = useAppState();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background dark:bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-foreground dark:text-background" />
      </div>
    );
  }

  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;

  // Banned handling - temporarily redirect to home or login
  if (user.is_banned) return <Navigate to="/" replace />;

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'seller') return <Navigate to="/seller" replace />;
    if (user.role === 'buyer') return <Navigate to="/buyer" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const DashboardRedirect = () => {
    const { user, isLoading } = useAppState();
    const location = useLocation();
    
    if (isLoading) return null;
    if (!user) return <Navigate to="/login" replace />;
    
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    const rolePath = user.role === 'seller' ? '/seller' : '/buyer';
    
    if (location.pathname === '/orders') {
        return <Navigate to={`${rolePath}?tab=orders`} replace />;
    }
    if (location.pathname === '/profile') {
        return <Navigate to="/settings" replace />;
    }
    
    return <Navigate to={rolePath} replace />;
};

const FooterLink: React.FC<PropsWithChildren<{ href: string }>> = ({ href, children }) => (
    <li>
        <Link 
            to={href} 
            className="text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background transition-all text-[11px] font-semibold uppercase tracking-widest flex items-center group/link"
        >
            <span className="w-0 group-hover/link:w-3 h-[1px] bg-primary dark:bg-background mr-0 group-hover/link:mr-2 transition-all duration-300"></span>
            {children}
        </Link>
    </li>
);

const BackToTop = () => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const toggle = () => setVisible(window.scrollY > 500);
        window.addEventListener('scroll', toggle);
        return () => window.removeEventListener('scroll', toggle);
    }, []);

    if (!visible) return null;

    return (
        <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-[100] w-12 h-12 bg-background dark:bg-background border border-foreground/20 dark:border-background/20 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all text-foreground dark:text-background group"
        >
            <ChevronUp className="w-5 h-5 stroke-[1] group-hover:-translate-y-1 transition-transform" />
        </button>
    );
};

const Preloader = () => {
    return (
        <motion.div 
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1, delay: 2, ease: "easeInOut" }}
            onAnimationComplete={() => document.body.style.overflow = 'auto'}
            className="fixed inset-0 z-[1000] bg-background flex flex-col items-center justify-center"
        >
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative"
            >
                <h1 className="text-6xl md:text-8xl font-sans font-extrabold text-foreground tracking-tight leading-none">
                    Mali<span className="text-primary">Mart</span>
                </h1>
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                    className="absolute -bottom-4 left-0 h-[1px] bg-background/50"
                />
            </motion.div>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
                className="mt-12 text-[10px] uppercase tracking-[0.5em] text-background/60"
            >
                Curated Excellence
            </motion.p>
        </motion.div>
    );
};

const ScrollProgress = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const updateProgress = () => {
            const currentScroll = window.scrollY;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollHeight) {
                setProgress(Number((currentScroll / scrollHeight).toFixed(2)) * 100);
            }
        };
        window.addEventListener('scroll', updateProgress);
        return () => window.removeEventListener('scroll', updateProgress);
    }, []);

    return (
        <div className="fixed top-0 left-0 w-full h-[2px] z-[100] pointer-events-none">
            <motion.div 
                className="h-full bg-primary dark:bg-background origin-left"
                style={{ scaleX: progress / 100 }}
            />
        </div>
    );
};

const AppContent = () => {
  const { isDark, user } = useAppState();
  const location = useLocation();
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    if (showPreloader) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [showPreloader]);

  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-primary selection:text-background dark:selection:bg-background dark:selection:text-foreground transition-all duration-700 ${isDark ? 'atmosphere-dark' : 'atmosphere-light'}`}>
      <AnimatePresence>
        {showPreloader && <Preloader />}
      </AnimatePresence>
      <ScrollProgress />
      <Navbar />
      <MobileBottomNav />
      <AIChatAssistant />
      <BackToTop />
      
      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<StorePage />} />  {/* Shop now uses StorePage */}
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/store/:id" element={<StorePage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<Navigate to="/buyer?tab=wishlist" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/buyer" element={<RouteGuard requiredRole="buyer"><BuyerPage /></RouteGuard>} />
              <Route path="/seller" element={<RouteGuard requiredRole="seller"><SellerPage /></RouteGuard>} />
              <Route path="/admin" element={<RouteGuard requiredRole="admin"><AdminPage /></RouteGuard>} />
              <Route path="/profile" element={<DashboardRedirect />} />
              <Route path="/orders" element={<DashboardRedirect />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/settings" element={<RouteGuard>{user?.role === 'seller' ? <SellerSettingsPage /> : <BuyerSettingsPage />}</RouteGuard>} />
              <Route path="/notifications" element={<RouteGuard><NotificationsPage /></RouteGuard>} />
              <Route path="/order-confirmation" element={<RouteGuard><OrderConfirmationPage /></RouteGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AppStateProvider>
        <SocketProvider>
          <Router>
            <ScrollToTop />
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </Router>
        </SocketProvider>
      </AppStateProvider>
    </ToastProvider>
  );
};

export default App;
