"use client";

import { useState, useEffect } from 'react';
import {
    Plus,
    ExternalLink,
    Trash2,
    Eye,
    EyeOff,
    Globe,
    User,
    Lock,
    FileText,
    X,
    LogOut,
    Mail,
    Send,
    Bell,
    BellOff,
    GraduationCap,
    CheckCircle2,
    AlertCircle,
    Save,
    Link as LinkIcon,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';

interface SavedLink {
    id: string;
    siteName: string;
    siteUrl: string;
    username?: string;
    password?: string;
    notes?: string;
}

export default function ProfilePage() {
    const { token, user, logout, updateUser, refreshUser } = useAuth();
    const [links, setLinks] = useState<SavedLink[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

    // Telegram & Preferences state
    const [chatIdInput, setChatIdInput] = useState(user?.telegramChatId || '');
    const [allowReminders, setAllowReminders] = useState<boolean>(user?.allowReminders !== false);
    const [lessonMode, setLessonMode] = useState<boolean>(!!user?.lessonMode);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsSuccess, setSettingsSuccess] = useState(false);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [deepLink, setDeepLink] = useState<string | null>(null);

    // Form state for saved links
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (user) {
            setChatIdInput(user.telegramChatId || '');
            setAllowReminders(user.allowReminders !== false);
            setLessonMode(!!user.lessonMode);
        }
    }, [user]);

    useEffect(() => {
        if (!token) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        fetch(`${apiUrl}/links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : [])
            .then(setLinks)
            .catch(console.error);
    }, [token]);

    // Save Telegram & Reminder Preferences
    const handleSavePreferences = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!token) return;
        setSavingSettings(true);
        setSettingsSuccess(false);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/auth/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    telegramChatId: chatIdInput.trim() || null,
                    allowReminders,
                    lessonMode
                })
            });

            if (res.ok) {
                const updated = await res.json();
                updateUser(updated);
                setSettingsSuccess(true);
                setTimeout(() => setSettingsSuccess(false), 3000);
            } else {
                alert('Sozlamalarni saqlashda xatolik yuz berdi');
            }
        } catch (err) {
            console.error('Failed to update settings:', err);
            alert('Tarmoq xatoligi');
        } finally {
            setSavingSettings(false);
        }
    };

    // Generate Telegram /start Link Code
    const handleGenerateTelegramLink = async () => {
        if (!token) return;
        setGeneratingLink(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/auth/telegram/link-code`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDeepLink(data.deepLink);
                // Open Telegram in a new window or app
                window.open(data.deepLink, '_blank');
            }
        } catch (err) {
            console.error('Failed to generate Telegram link:', err);
        } finally {
            setGeneratingLink(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ siteName, siteUrl, username, password, notes }),
            });
            if (res.ok) {
                const newLink = await res.json();
                setLinks([newLink, ...links]);
                setSiteName(''); setSiteUrl(''); setUsername(''); setPassword(''); setNotes('');
                setShowForm(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            await fetch(`${apiUrl}/links/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            setLinks(links.filter(l => l.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const togglePassword = (id: string) => {
        const next = new Set(visiblePasswords);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setVisiblePasswords(next);
    };

    const openSite = (url: string) => {
        let finalUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            finalUrl = 'https://' + url;
        }
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
    };

    const isConnected = !!user?.telegramChatId;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* User Profile Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-md">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
                            <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                                <Mail size={14} />
                                {user?.email}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-5 py-2.5 text-red-600 font-bold hover:bg-red-100 transition-colors"
                    >
                        <LogOut size={18} />
                        Chiqish
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TELEGRAM VA ESLATMA RUXSATI SOZLAMALARI */}
            {/* ========================================================================= */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Send size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                Telegram Integratsiyasi va Eslatmalar
                            </h2>
                            <p className="text-xs text-gray-500 font-medium">
                                Telegram bot bilan hisobni bog‘lash, Chat ID va eslatma ruxsatlarini boshqarish
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerateTelegramLink}
                        disabled={generatingLink}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xs"
                    >
                        <LinkIcon size={14} />
                        {generatingLink ? 'Bog‘lanmoqda...' : 'Telegram Botda /start Bosish'}
                    </button>
                </div>

                <form onSubmit={handleSavePreferences} className="space-y-5">
                    {/* Status Banner */}
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isConnected
                            ? 'bg-green-50/70 border-green-200 text-green-900'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}>
                        <div className="flex items-center gap-3">
                            {isConnected ? (
                                <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
                            ) : (
                                <AlertCircle size={24} className="text-amber-600 flex-shrink-0" />
                            )}
                            <div>
                                <p className="text-sm font-bold">
                                    {isConnected ? 'Telegram muvaffaqiyatli ulangan' : 'Telegram hali ulanmagan'}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    {isConnected
                                        ? `Ulangan Chat ID: ${user?.telegramChatId}`
                                        : 'Botda /start bosilganda profilingiz avtomatik ulanadi va Chat ID shu yerda aks etadi.'
                                    }
                                </p>
                            </div>
                        </div>

                        {deepLink && (
                            <a
                                href={deepLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-blue-600 underline"
                            >
                                Bot havolasi: {deepLink}
                            </a>
                        )}
                    </div>

                    {/* Telegram Chat ID Field */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Telegram Chat ID
                            </label>
                            <div className="relative">
                                <Send size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={chatIdInput}
                                    onChange={(e) => setChatIdInput(e.target.value)}
                                    placeholder="Masalan: 6711922793"
                                    className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                                Botda /start bosganda avtomatik qo‘shiladi yoki qo‘lda kiritishingiz mumkin.
                            </p>
                        </div>

                        {/* ========================================================================= */}
                        {/* 🎓 DARS REJIMI (LESSON MODE) TOGGLE */}
                        {/* ========================================================================= */}
                        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500 text-white rounded-lg">
                                    <GraduationCap size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-950">Dars Rejimi (Lesson Mode)</h4>
                                    <p className="text-xs text-amber-800/80 mt-0.5">
                                        {lessonMode
                                            ? 'Dars paytida eslatmalar yuborilmaydi (Sokin rejim)'
                                            : 'Oddiy rejim — Eslatmalar reja bo‘yicha keladi'
                                        }
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={lessonMode}
                                    onChange={(e) => setLessonMode(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* ESLATMA YUBORISH MUMKIN YOKI YO'Q (ALLOW REMINDERS TOGGLE) */}
                    {/* ========================================================================= */}
                    <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg text-white ${allowReminders ? 'bg-blue-600' : 'bg-gray-400'}`}>
                                {allowReminders ? <Bell size={20} /> : <BellOff size={20} />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-blue-950">
                                    Telegram orqali Eslatma Yuborish Ruxsati
                                </h4>
                                <p className="text-xs text-blue-800/80 mt-0.5">
                                    {allowReminders
                                        ? '✅ Eslatma yuborish MUMKIN (Bot barcha rejalashtirilgan eslatmalarni yuboradi)'
                                        : '❌ Eslatma yuborish O‘CHIRILGAN (Bot hech qanday xabar yubormaydi)'
                                    }
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allowReminders}
                                onChange={(e) => setAllowReminders(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={savingSettings}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs"
                        >
                            <Save size={16} />
                            {savingSettings ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}
                        </button>
                        {settingsSuccess && (
                            <span className="text-xs font-bold text-green-600 flex items-center gap-1 animate-in fade-in">
                                <CheckCircle2 size={16} /> Sozlamalar muvaffaqiyatli saqlandi!
                            </span>
                        )}
                    </div>
                </form>
            </div>

            {/* Saved Sites Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Saqlangan Saytlar</h2>
                    <p className="text-xs text-gray-500 font-medium">Tezkor kirish uchun parollar va loginlar</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                    {showForm ? 'Bekor qilish' : 'Sayt Qo‘shish'}
                </button>
            </div>

            {/* Add Link Form */}
            {showForm && (
                <form onSubmit={handleAdd} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
                    <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">Yangi Sayt Qo‘shish</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sayt Nomi</label>
                            <div className="relative">
                                <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500/70" />
                                <input type="text" required value={siteName} onChange={e => setSiteName(e.target.value)}
                                    placeholder="Masalan: Gmail" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm placeholder:text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Elektron manzil (URL)</label>
                            <input type="text" required value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                                placeholder="gmail.com" className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm placeholder:text-gray-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Login yoki pochta</label>
                            <div className="relative">
                                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500/70" />
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    placeholder="Foydalanuvchi nomi" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm placeholder:text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Parol</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500/70" />
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm placeholder:text-gray-400" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Izoh</label>
                        <div className="relative">
                            <FileText size={18} className="absolute left-3.5 top-3.5 text-blue-500/70" />
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="Qo‘shimcha ma‘lumot..." rows={2}
                                className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm placeholder:text-gray-400 resize-none" />
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="bg-blue-600 w-full sm:w-auto text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm focus:ring-4 focus:ring-blue-500/30">
                            Saqlash
                        </button>
                    </div>
                </form>
            )}

            {/* Links Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {links.map(link => (
                    <div key={link.id} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">{link.siteName}</h4>
                                    <p className="text-xs text-gray-400 truncate max-w-[150px]">{link.siteUrl}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(link.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {link.username && (
                            <div className="text-sm mb-1">
                                <span className="text-gray-400">Login: </span>
                                <span className="text-gray-700 font-medium">{link.username}</span>
                            </div>
                        )}
                        {link.password && (
                            <div className="text-sm mb-1 flex items-center gap-2">
                                <span className="text-gray-400">Parol: </span>
                                <span className="text-gray-700 font-mono">
                                    {visiblePasswords.has(link.id) ? link.password : '••••••••'}
                                </span>
                                <button onClick={() => togglePassword(link.id)} className="text-gray-400 hover:text-blue-500">
                                    {visiblePasswords.has(link.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        )}
                        {link.notes && <p className="text-xs text-gray-400 mt-2">{link.notes}</p>}

                        <button
                            onClick={() => openSite(link.siteUrl)}
                            className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors text-xs"
                        >
                            <ExternalLink size={15} />
                            Saytga kirish
                        </button>
                    </div>
                ))}
            </div>

            {links.length === 0 && !showForm && (
                <div className="text-center py-12 text-gray-400 font-medium">
                    Hozircha saqlangan saytlar yo‘q. Yuqoridagi "Sayt Qo‘shish" tugmasini bosing.
                </div>
            )}
        </div>
    );
}
