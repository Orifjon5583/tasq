"use client";

import { useState, useEffect, useMemo } from 'react';
import {
    PlusCircle,
    Type,
    AlertCircle,
    Clock,
    Save,
    Calendar,
    Bell,
    Check,
    X,
    Repeat,
    Sliders,
    HelpCircle,
    CalendarClock
} from 'lucide-react';

export type ReminderTypeOption = 'NONE' | 'ONCE' | 'REPEATED' | 'CUSTOM';

export interface TaskFormData {
    id?: string;
    title: string;
    description?: string;
    priority: 'NORMAL' | 'IMPORTANT' | 'FUTURE';
    durationMinutes: number;
    startDate: string;      // YYYY-MM-DD
    startTime: string;      // HH:mm
    dueAtDate: string;      // YYYY-MM-DD
    dueAtTime: string;      // HH:mm
    // Section "ESLATMA SOZLAMALARI"
    reminderType: ReminderTypeOption;
    firstReminderDate: string; // YYYY-MM-DD
    firstReminderTime: string; // HH:mm
    intervalMinutes: number;
    customIntervalMinutes: number;
    stopAtDeadline: boolean;
    maxReminders: number | '';
}

interface TaskFormProps {
    initialTask?: any;
    onSave: (savedTask: any) => void;
    onCancel?: () => void;
    isEditing?: boolean;
}

const INTERVAL_OPTIONS = [
    { label: 'Har 5 daqiqada', value: 5 },
    { label: 'Har 10 daqiqada', value: 10 },
    { label: 'Har 15 daqiqada', value: 15 },
    { label: 'Har 20 daqiqada', value: 20 },
    { label: 'Har 30 daqiqada', value: 30 },
    { label: 'Har 45 daqiqada', value: 45 },
    { label: 'Har 1 soatda', value: 60 },
    { label: 'Har 2 soatda', value: 120 },
    { label: 'Boshqa (Maxsus)', value: -1 },
];

export default function TaskForm({ initialTask, onSave, onCancel, isEditing = false }: TaskFormProps) {
    const todayStr = useMemo(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, []);

    // Form states
    const [title, setTitle] = useState(initialTask?.title || '');
    const [description, setDescription] = useState(initialTask?.description || '');
    const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'FUTURE'>(initialTask?.priority || 'NORMAL');
    const [duration, setDuration] = useState<number>(initialTask?.durationMinutes || 60);

    // Start Date & Time
    const [startDate, setStartDate] = useState<string>(() => {
        if (initialTask?.startAt) {
            const d = new Date(initialTask.startAt);
            return d.toISOString().split('T')[0];
        }
        return todayStr;
    });

    const [startTime, setStartTime] = useState<string>(() => {
        if (initialTask?.startAt) {
            const d = new Date(initialTask.startAt);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        return '09:00';
    });

    // Task Deadline (dueAt) - independent field
    const [dueAtDate, setDueAtDate] = useState<string>(() => {
        if (initialTask?.dueAt) {
            const d = new Date(initialTask.dueAt);
            return d.toISOString().split('T')[0];
        }
        return todayStr;
    });

    const [dueAtTime, setDueAtTime] = useState<string>(() => {
        if (initialTask?.dueAt) {
            const d = new Date(initialTask.dueAt);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        return '18:00';
    });

    const [hasDeadline, setHasDeadline] = useState<boolean>(!!initialTask?.dueAt);

    // --- Section "ESLATMA SOZLAMALARI" ---
    const initialReminder = initialTask?.reminder;
    const [reminderType, setReminderType] = useState<ReminderTypeOption>(() => {
        if (initialReminder?.reminderType) return initialReminder.reminderType;
        return 'REPEATED';
    });

    // First reminder date and time - independent field
    const [firstReminderDate, setFirstReminderDate] = useState<string>(() => {
        if (initialReminder?.firstReminderAt) {
            const d = new Date(initialReminder.firstReminderAt);
            return d.toISOString().split('T')[0];
        }
        return todayStr;
    });

    const [firstReminderTime, setFirstReminderTime] = useState<string>(() => {
        if (initialReminder?.firstReminderAt) {
            const d = new Date(initialReminder.firstReminderAt);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        return '09:10'; // Example default matching the spec!
    });

    // Interval options
    const [selectedInterval, setSelectedInterval] = useState<number>(() => {
        const mins = initialReminder?.intervalMinutes;
        if (!mins) return 20;
        const exists = INTERVAL_OPTIONS.some(o => o.value === mins);
        return exists ? mins : -1;
    });

    const [customMinutes, setCustomMinutes] = useState<number>(() => {
        const mins = initialReminder?.intervalMinutes;
        if (mins && !INTERVAL_OPTIONS.some(o => o.value === mins)) {
            return mins;
        }
        return 25;
    });

    const [stopAtDeadline, setStopAtDeadline] = useState<boolean>(initialReminder?.stopAtDeadline !== false);
    const [maxReminders, setMaxReminders] = useState<number | ''>(initialReminder?.maxReminders || '');
    const [loading, setLoading] = useState(false);

    // Effective interval in minutes
    const effectiveInterval = selectedInterval === -1 ? (Number(customMinutes) || 20) : selectedInterval;

    // Synchronize first reminder time if user changes start time and first reminder hasn't been edited
    const handleSetFirstReminderFromStart = (offsetMinutes: number = 0) => {
        if (!startDate || !startTime) return;
        const [hh, mm] = startTime.split(':').map(Number);
        const dt = new Date(`${startDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
        dt.setMinutes(dt.getMinutes() + offsetMinutes);
        const yyyy = dt.getFullYear();
        const mon = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        setFirstReminderDate(`${yyyy}-${mon}-${day}`);
        setFirstReminderTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
    };

    // Calculate Reminder Preview Schedule
    const reminderPreview = useMemo(() => {
        if (reminderType === 'NONE') return [];

        const schedule: { timeStr: string; note: string }[] = [];
        try {
            const [fYear, fMon, fDay] = firstReminderDate.split('-').map(Number);
            const [fHour, fMin] = firstReminderTime.split(':').map(Number);
            let current = new Date(fYear, fMon - 1, fDay, fHour, fMin);

            let deadlineDate: Date | null = null;
            if (hasDeadline && dueAtDate && dueAtTime) {
                const [dYear, dMon, dDay] = dueAtDate.split('-').map(Number);
                const [dHour, dMin] = dueAtTime.split(':').map(Number);
                deadlineDate = new Date(dYear, dMon - 1, dDay, dHour, dMin);
            }

            const maxCount = maxReminders !== '' ? Number(maxReminders) : 5;
            const limit = Math.min(maxCount, 5); // show up to 5 items in preview

            for (let i = 1; i <= limit; i++) {
                if (stopAtDeadline && deadlineDate && current > deadlineDate) {
                    break;
                }

                const hh = String(current.getHours()).padStart(2, '0');
                const mm = String(current.getMinutes()).padStart(2, '0');
                const datePrefix = (current.toISOString().split('T')[0] !== startDate)
                    ? `${String(current.getDate()).padStart(2, '0')}.${String(current.getMonth() + 1).padStart(2, '0')} `
                    : '';

                schedule.push({
                    timeStr: `${datePrefix}${hh}:${mm}`,
                    note: `${i}-eslatma`
                });

                if (reminderType === 'ONCE') break;

                // Add interval
                current = new Date(current.getTime() + effectiveInterval * 60000);
            }
        } catch (e) {
            console.error('Schedule preview calculation error:', e);
        }
        return schedule;
    }, [reminderType, firstReminderDate, firstReminderTime, effectiveInterval, stopAtDeadline, hasDeadline, dueAtDate, dueAtTime, maxReminders, startDate]);

    // Handle Form Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Build ISO timestamps
            const startAt = startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : undefined;
            const dueAt = hasDeadline && dueAtDate && dueAtTime ? new Date(`${dueAtDate}T${dueAtTime}`).toISOString() : undefined;

            let reminderPayload: any = {
                reminderType,
                stopAtDeadline,
                maxReminders: maxReminders !== '' ? Number(maxReminders) : null
            };

            if (reminderType !== 'NONE') {
                const firstReminderAt = firstReminderDate && firstReminderTime
                    ? new Date(`${firstReminderDate}T${firstReminderTime}`).toISOString()
                    : undefined;

                reminderPayload = {
                    ...reminderPayload,
                    firstReminderAt,
                    intervalMinutes: reminderType === 'ONCE' ? null : effectiveInterval
                };
            }

            const payload = {
                title,
                description: description || undefined,
                priority,
                durationMinutes: Number(duration),
                startAt,
                dueAt,
                reminder: reminderPayload
            };

            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

            let res;
            if (isEditing && initialTask?.id) {
                // Update
                res = await fetch(`${apiUrl}/tasks/${initialTask.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create
                res = await fetch(`${apiUrl}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (res.ok) {
                const savedData = await res.json();
                onSave(savedData);
                if (!isEditing) {
                    setTitle('');
                    setDescription('');
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Xatolik yuz berdi: ${errData.message || errData.error || 'Saqlanmadi'}`);
            }
        } catch (error: any) {
            console.error('Failed to save task:', error);
            alert('Tarmoq xatoligi: Server bilan aloqa o‘rnatilmadi!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <PlusCircle className="text-blue-600" size={22} />
                    {isEditing ? 'Vazifani Tahrirlash' : 'Yangi Vazifa Qo‘shish'}
                </h3>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Task Title */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Vazifa Nomi <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Type size={18} className="text-blue-500/70" />
                    </div>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="block w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm"
                        placeholder="Masalan: Prepare Arduino lesson"
                    />
                </div>
            </div>

            {/* Task Description */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tavsif (Ixtiyoriy)</label>
                <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full px-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm"
                    placeholder="Qo‘shimcha tafsilotlar..."
                />
            </div>

            {/* Section 2: Task Start Date and Start Time */}
            <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100 space-y-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    Boshlanish Vaqti & Davomiylik
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Boshlanish Sanasi</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar size={16} className="text-gray-400" />
                            </div>
                            <input
                                type="date"
                                required
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Boshlanish Soati</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Clock size={16} className="text-gray-400" />
                            </div>
                            <input
                                type="time"
                                required
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Muhimlik Darajasi</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <AlertCircle size={16} className={priority === 'IMPORTANT' ? 'text-red-500' : 'text-blue-500'} />
                            </div>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as any)}
                                className="block w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="NORMAL">Oddiy (Normal)</option>
                                <option value="IMPORTANT">Muhim (Important)</option>
                                <option value="FUTURE">Kelajakda (Future)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Davomiyligi</label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="block w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value={15}>15 daqiqa</option>
                            <option value={30}>30 daqiqa</option>
                            <option value={45}>45 daqiqa</option>
                            <option value={60}>1 soat</option>
                            <option value={90}>1.5 soat</option>
                            <option value={120}>2 soat</option>
                            <option value={180}>3 soat</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Task Deadline (dueAt) - Independent Field */}
            <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarClock size={15} className="text-amber-500" />
                        Topshiriq Muddati (Deadline)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                            type="checkbox"
                            checked={hasDeadline}
                            onChange={(e) => setHasDeadline(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        Muddatni belgilash
                    </label>
                </div>

                {hasDeadline && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Oxirgi Sana (Deadline)</label>
                            <input
                                type="date"
                                required={hasDeadline}
                                value={dueAtDate}
                                onChange={(e) => setDueAtDate(e.target.value)}
                                className="block w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Oxirgi Soat (Deadline)</label>
                            <input
                                type="time"
                                required={hasDeadline}
                                value={dueAtTime}
                                onChange={(e) => setDueAtTime(e.target.value)}
                                className="block w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* SECTION 8 & SECTION 1: ESLATMA SOZLAMALARI (DEDICATED SECTION) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-100/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                            <Bell size={18} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm tracking-wide">
                                ESLATMA SOZLAMALARI
                            </h4>
                            <p className="text-xs text-gray-500 font-medium">
                                Har bir vazifa uchun individual va mustaqil eslatma tizimi
                            </p>
                        </div>
                    </div>
                </div>

                {/* 1. Individual Reminder Options */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Eslatma Turi
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { id: 'NONE', label: 'Eslatmasiz', sub: 'O‘chirilgan', icon: X },
                            { id: 'ONCE', label: '1 Martalik', sub: 'Faqat bir marta', icon: Bell },
                            { id: 'REPEATED', label: 'Takroriy', sub: 'Muntazam eslatish', icon: Repeat },
                            { id: 'CUSTOM', label: 'Maxsus Interval', sub: 'Moslashuvchan', icon: Sliders }
                        ].map((item) => {
                            const IconComponent = item.icon;
                            const isSelected = reminderType === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setReminderType(item.id as ReminderTypeOption)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                                        isSelected
                                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <IconComponent size={18} className={isSelected ? 'text-white mb-1' : 'text-blue-500 mb-1'} />
                                    <span className="text-xs font-bold">{item.label}</span>
                                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {item.sub}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Reminder Details (If not NONE) */}
                {reminderType !== 'NONE' && (
                    <div className="space-y-4 pt-1">
                        {/* Section 2: First Reminder Time (Independent Field) */}
                        <div className="bg-white rounded-xl p-3.5 border border-blue-100 shadow-sm space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                    <Clock size={15} className="text-blue-600" />
                                    Birinchi Eslatma Vaqti (First Reminder Time)
                                </label>
                                <span className="text-[11px] text-gray-500 font-medium">Mustaqil maydon</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Eslatma Sanasi</label>
                                    <input
                                        type="date"
                                        required
                                        value={firstReminderDate}
                                        onChange={(e) => setFirstReminderDate(e.target.value)}
                                        className="block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Eslatma Soati</label>
                                    <input
                                        type="time"
                                        required
                                        value={firstReminderTime}
                                        onChange={(e) => setFirstReminderTime(e.target.value)}
                                        className="block w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Quick helper buttons for first reminder time */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] text-gray-400 font-medium mr-1">Tezkor:</span>
                                <button
                                    type="button"
                                    onClick={() => handleSetFirstReminderFromStart(0)}
                                    className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 font-medium transition-colors"
                                >
                                    Boshlanish vaqtida ({startTime})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetFirstReminderFromStart(10)}
                                    className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 font-medium transition-colors"
                                >
                                    +10 daqiqadan so‘ng
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetFirstReminderFromStart(-15)}
                                    className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 font-medium transition-colors"
                                >
                                    15 daqiqa oldin
                                </button>
                            </div>
                        </div>

                        {/* Interval Settings (For REPEATED and CUSTOM) */}
                        {(reminderType === 'REPEATED' || reminderType === 'CUSTOM') && (
                            <div className="bg-white rounded-xl p-3.5 border border-blue-100 shadow-sm space-y-3">
                                <label className="block text-xs font-bold text-gray-800">
                                    Takrorlanish Oralig‘i (Reminder Interval)
                                </label>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {INTERVAL_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSelectedInterval(opt.value)}
                                            className={`px-3 py-2 rounded-lg text-xs font-semibold text-center border transition-all ${
                                                selectedInterval === opt.value
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/10'
                                                    : 'border-gray-200 bg-gray-50/50 text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom interval minutes input */}
                                {selectedInterval === -1 && (
                                    <div className="pt-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Maxsus daqiqa sonini kiriting:
                                        </label>
                                        <div className="relative max-w-xs">
                                            <input
                                                type="number"
                                                min={1}
                                                max={1440}
                                                value={customMinutes}
                                                onChange={(e) => setCustomMinutes(Math.max(1, Number(e.target.value)))}
                                                className="block w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                                                placeholder="Masalan: 25"
                                            />
                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 font-medium pointer-events-none">
                                                daqiqa
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Stopping Conditions */}
                                <div className="pt-2 border-t border-gray-100 space-y-2">
                                    <span className="text-xs font-bold text-gray-700 block">To‘xtatish Shartlari:</span>

                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={stopAtDeadline}
                                            onChange={(e) => setStopAtDeadline(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span>Topshiriq muddati (deadline) tugaganda eslatmalarni to‘xtatish</span>
                                    </label>

                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-xs text-gray-600 font-medium">Maksimal eslatmalar soni (ixtiyoriy):</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={maxReminders}
                                            onChange={(e) => setMaxReminders(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="Cheksiz"
                                            className="w-24 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* Section 8: LIVE PREVIEW OF NEXT REMINDER SCHEDULE */}
                        {/* ========================================================================= */}
                        <div className="rounded-xl bg-blue-500/10 border border-blue-200 p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wide">
                                    <CalendarClock size={16} className="text-blue-700" />
                                    Eslatmalar Jadvali (Ko‘rib Chiqish Preview)
                                </span>
                                <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                    {reminderType === 'ONCE' ? '1 ta eslatma' : `Oraliq: ${effectiveInterval} daqiqa`}
                                </span>
                            </div>

                            {reminderPreview.length > 0 ? (
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {reminderPreview.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-blue-200 text-xs shadow-2xs"
                                            >
                                                <Clock size={13} className="text-blue-600" />
                                                <span className="font-bold text-gray-900">{item.timeStr}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">({item.note})</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-blue-800/80 font-medium pt-1">
                                        {reminderType === 'ONCE'
                                            ? 'Vazifa uchun faqat belgilangan vaqtda bitta eslatma yuboriladi.'
                                            : `Vazifa bajarilmaguncha har ${effectiveInterval} daqiqada xabar yuboriladi. Bajarilgach, eslatmalar darhol to‘xtaydi.`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500">
                                    Vaqt sozlamalarini to‘ldiring, rejalashtirilgan eslatmalar bu yerda aks etadi.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit / Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                    >
                        Bekor Qilish
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:bg-blue-300 font-bold shadow-sm transition-all"
                >
                    {loading ? 'Saqlanmoqda...' : <><Save size={18} /> {isEditing ? 'O‘zgarishlarni Saqlash' : 'Vazifani Saqlash'}</>}
                </button>
            </div>
        </form>
    );
}
