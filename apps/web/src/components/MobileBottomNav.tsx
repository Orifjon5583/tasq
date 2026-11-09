"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckSquare, Home, Calendar, Wallet, UserCircle } from 'lucide-react';

export default function MobileBottomNav() {
    const pathname = usePathname();

    const tabs = [
        { href: '/dashboard/tasks', label: 'Vazifalar', icon: CheckSquare },
        { href: '/dashboard', label: 'Asosiy', icon: Home },
        { href: '/dashboard/scheduler', label: 'Reja', icon: Calendar },
        { href: '/dashboard/finance', label: 'Moliya', icon: Wallet },
        { href: '/dashboard/profile', label: 'Profil', icon: UserCircle },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 md:hidden px-2 py-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-around">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = pathname === tab.href;

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                                isActive
                                    ? 'text-blue-600 font-bold'
                                    : 'text-gray-400 hover:text-gray-600 font-medium'
                            }`}
                        >
                            <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : ''}`}>
                                <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                            </div>
                            <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
                            {isActive && (
                                <span className="absolute top-1 right-2.5 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-white"></span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
