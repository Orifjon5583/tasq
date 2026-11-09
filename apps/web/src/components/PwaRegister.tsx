"use client";

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function PwaRegister() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    useEffect(() => {
        // Register service worker
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('PWA ServiceWorker registered with scope:', registration.scope);
                })
                .catch((err) => {
                    console.error('PWA ServiceWorker registration failed:', err);
                });
        }

        // Catch PWA install prompt
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the PWA install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallBanner(false);
    };

    if (!showInstallBanner) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 z-50 max-w-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-white/20 animate-in fade-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs">
                    <Download size={20} className="text-white" />
                </div>
                <div>
                    <h5 className="text-xs font-bold leading-tight">Tasq Ilovasini O‘rnatish</h5>
                    <p className="text-[11px] text-blue-100 mt-0.5">Tez va qulay foydalanish uchun ekranga qo‘shing</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={handleInstallClick}
                    className="px-3 py-1.5 bg-white text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors shadow-2xs"
                >
                    O‘rnatish
                </button>
                <button
                    onClick={() => setShowInstallBanner(false)}
                    className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
