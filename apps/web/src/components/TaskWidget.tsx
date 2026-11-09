"use client";

import { useState } from 'react';
import {
    CheckCircle,
    Circle,
    Clock,
    Trash2,
    Edit2,
    Pause,
    Play,
    Bell,
    BellOff,
    RotateCcw,
    CalendarClock,
    AlertCircle,
    ChevronDown,
    MoreVertical
} from 'lucide-react';

export interface TaskItem {
    id: string;
    title: string;
    description?: string;
    time?: string;
    startAt?: string;
    dueAt?: string;
    priority?: 'NORMAL' | 'IMPORTANT' | 'FUTURE';
    status: 'pending' | 'done' | 'TODO' | 'IN_PROGRESS' | 'DONE';
    durationMinutes?: number;
    reminder?: {
        id?: string;
        reminderType: 'NONE' | 'ONCE' | 'REPEATED' | 'CUSTOM';
        intervalMinutes?: number | null;
        firstReminderAt?: string | null;
        nextReminderAt?: string | null;
        isEnabled: boolean;
        isPaused: boolean;
        stopAtDeadline: boolean;
        sentCount?: number;
        snoozedUntil?: string | null;
    } | null;
}

interface TaskWidgetProps {
    tasks: TaskItem[];
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit?: (task: TaskItem) => void;
    onReminderAction?: (taskId: string, action: { type: string; minutes?: number; nextTime?: string }) => void;
}

export default function TaskWidget({ tasks, onToggle, onDelete, onEdit, onReminderAction }: TaskWidgetProps) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const isTaskDone = (task: TaskItem) => {
        return task.status === 'done' || task.status === 'DONE';
    };

    const formatTimeOnly = (dateStr?: string | null) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch {
            return null;
        }
    };

    const formatDateAndTime = (dateStr?: string | null) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
            return `${date} ${time}`;
        } catch {
            return null;
        }
    };

    return (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Vazifalar Ro‘yxati</h3>
                    <p className="text-xs text-gray-500 font-medium">Har bir vazifaning o‘z eslatma holati</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                        Jami: {tasks.length}
                    </span>
                    <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-3 py-1 rounded-full">
                        Bajarilgan: {tasks.filter(isTaskDone).length}
                    </span>
                </div>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
                {tasks.map((task) => {
                    const done = isTaskDone(task);
                    const reminder = task.reminder;
                    const hasActiveReminder = reminder && reminder.reminderType !== 'NONE' && reminder.isEnabled && !done;
                    const isPaused = reminder?.isPaused;
                    const isSnoozed = reminder?.snoozedUntil && new Date(reminder.snoozedUntil) > new Date();

                    return (
                        <div
                            key={task.id}
                            className={`group relative p-4 rounded-xl border transition-all ${
                                done
                                    ? 'bg-gray-50/70 border-gray-100 opacity-80'
                                    : 'bg-white border-gray-200/80 hover:border-blue-200 hover:shadow-xs'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                {/* Left checkbox & details */}
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => onToggle(task.id)}
                                        className={`mt-0.5 rounded-full p-0.5 transition-colors ${
                                            done ? 'text-green-600 hover:text-green-700' : 'text-gray-300 hover:text-blue-600'
                                        }`}
                                        title={done ? 'Qayta ochish' : 'Bajarildi deb belgilash'}
                                    >
                                        {done ? <CheckCircle size={24} className="fill-green-50" /> : <Circle size={24} />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className={`text-base font-bold truncate ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                {task.title}
                                            </p>

                                            {/* Priority tag */}
                                            {task.priority === 'IMPORTANT' && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                                    Muhim
                                                </span>
                                            )}
                                        </div>

                                        {task.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                                                {task.description}
                                            </p>
                                        )}

                                        {/* Meta info: Start time, Deadline */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-medium mb-2.5">
                                            {task.startAt && (
                                                <span className="flex items-center gap-1 text-gray-600">
                                                    <Clock size={13} className="text-blue-500" />
                                                    Boshlanish: {formatDateAndTime(task.startAt)}
                                                </span>
                                            )}
                                            {task.dueAt && (
                                                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                                                    <CalendarClock size={13} />
                                                    Deadline: {formatDateAndTime(task.dueAt)}
                                                </span>
                                            )}
                                            {task.time && !task.startAt && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={13} />
                                                    {task.time}
                                                </span>
                                            )}
                                        </div>

                                        {/* Individual Reminder Status Badge */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {done ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                                    <CheckCircle size={12} className="text-green-500" />
                                                    Bajarilgan (Eslatmalar to‘xtatildi)
                                                </span>
                                            ) : !reminder || reminder.reminderType === 'NONE' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-500">
                                                    <BellOff size={12} />
                                                    Eslatmasiz
                                                </span>
                                            ) : isPaused ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                    <Pause size={12} />
                                                    Eslatmalar Pauzada
                                                </span>
                                            ) : isSnoozed ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                    <Clock size={12} />
                                                    Kechiktirildi: {formatTimeOnly(reminder.snoozedUntil)} gacha
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    <Bell size={12} className="text-blue-600 animate-pulse" />
                                                    {reminder.reminderType === 'ONCE' ? (
                                                        <>1 martalik: {formatDateAndTime(reminder.firstReminderAt || reminder.nextReminderAt)}</>
                                                    ) : (
                                                        <>
                                                            Har {reminder.intervalMinutes || 20} daqiqada
                                                            {reminder.nextReminderAt && ` (Keyingi: ${formatTimeOnly(reminder.nextReminderAt)})`}
                                                        </>
                                                    )}
                                                    {reminder.sentCount ? (
                                                        <span className="ml-1 bg-blue-200/70 text-blue-900 px-1.5 py-0.2 rounded-full text-[10px]">
                                                            №{reminder.sentCount}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right action buttons */}
                                <div className="flex items-center gap-1">
                                    {/* Reminder quick actions: Pause / Resume / Snooze */}
                                    {onReminderAction && reminder && reminder.reminderType !== 'NONE' && !done && (
                                        <>
                                            {isPaused ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onReminderAction(task.id, { type: 'resume' })}
                                                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Eslatmalarni davom ettirish (Resume)"
                                                >
                                                    <Play size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onReminderAction(task.id, { type: 'pause' })}
                                                    className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Eslatmalarni vaqtincha to‘xtatish (Pause)"
                                                >
                                                    <Pause size={16} />
                                                </button>
                                            )}

                                            {/* Snooze 20m button */}
                                            <button
                                                type="button"
                                                onClick={() => onReminderAction(task.id, { type: 'snooze', minutes: 20 })}
                                                className="px-2 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors hidden sm:inline-flex items-center gap-1"
                                                title="Keyingi eslatmani 20 daqiqaga kechiktirish"
                                            >
                                                +20 daq
                                            </button>
                                        </>
                                    )}

                                    {/* Edit Button */}
                                    {onEdit && (
                                        <button
                                            type="button"
                                            onClick={() => onEdit(task)}
                                            className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                            title="Vazifa va eslatmani tahrirlash"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => onDelete(task.id)}
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="O‘chirish"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {tasks.length === 0 && (
                    <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Clock size={36} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm font-bold text-gray-700">Hozircha vazifalar mavjud emas</p>
                        <p className="text-xs text-gray-400 mt-1">Yangi vazifa qo‘shing va o‘z eslatma rejangizni tuzing!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
