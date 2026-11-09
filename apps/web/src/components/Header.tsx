"use client";

import { useState } from 'react';
import { Bell, GraduationCap, Send, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function Header() {
    const { user, token, updateUser } = useAuth();
    const [togglingLesson, setTogglingLesson] = useState(false);

    const isLessonMode = !!user?.lessonMode;
    const isTelegramConnected = !!user?.telegramChatId;
    const allowReminders = user?.allowReminders !== false;

    const handleToggleLessonMode = async () => {
        if (!token) return;
        setTogglingLesson(true);
        const nextState = !isLessonMode;
        updateUser({ lessonMode: nextState });

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            await fetch(`${apiUrl}/auth/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ lessonMode: nextState })
            });
        } catch (e) {
            console.error('Failed to toggle lesson mode:', e);
            updateUser({ lessonMode: !nextState });
        } finally {
            setTogglingLesson(false);
        }
    };

    return (
        <header className="flex h-16 items-center justify-between bg-white px-4 sm:px-6 shadow-xs border-b border-gray-100">
            <div className="md:hidden w-10"></div> {/* Spacer for mobile menu button */}

            <div className="flex items-center gap-3">
                <h2 className="text-base sm:text-lg font-bold text-gray-800 hidden sm:block">
                    Xush kelibsiz, {user?.name || 'Foydalanuvchi'}!
                </h2>

                {/* 🎓 DARS REJIMI TOGGLE BUTTON */}
                <button
                    type="button"
                    onClick={handleToggleLessonMode}
                    disabled={togglingLesson}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                        isLessonMode
                            ? 'bg-amber-500 text-white ring-2 ring-amber-500/20 animate-pulse'
                            : 'bg-gray-100 text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                    title={isLessonMode ? "Dars rejimi faol — Eslatmalar to‘xtatilgan" : "Dars rejimini yoqish (sokin rejim)"}
                >
                    <GraduationCap size={16} />
                    <span>{isLessonMode ? 'Dars Rejimi: Faol' : 'Dars Rejimi'}</span>
                </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                {/* Telegram Connection Badge */}
                <a
                    href="/dashboard/profile"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        isTelegramConnected && allowReminders
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : isTelegramConnected && !allowReminders
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700'
                    }`}
                    title={
                        isTelegramConnected
                            ? allowReminders
                                ? `Telegram ulangan (ID: ${user?.telegramChatId}) — Eslatmalar faol`
                                : `Telegram ulangan (ID: ${user?.telegramChatId}) — Eslatmalar o‘chirilgan`
                            : "Telegram ulanmagan"
                    }
                >
                    <Send size={13} className={isTelegramConnected ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="hidden sm:inline">
                        {isTelegramConnected
                            ? (allowReminders ? 'Telegram: Faol' : 'Eslatmalar: Off')
                            : 'Telegram: Yo‘q'
                        }
                    </span>
                    {isTelegramConnected ? (
                        allowReminders ? <CheckCircle2 size={13} className="text-green-500" /> : <XCircle size={13} className="text-amber-500" />
                    ) : null}
                </a>

                {/* User Avatar */}
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
            </div>
        </header>
    );
}
