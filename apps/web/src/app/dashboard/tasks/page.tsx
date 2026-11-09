"use client";

import { useState, useEffect, useCallback } from 'react';
import TaskForm from '../../../components/TaskForm';
import TaskWidget, { TaskItem } from '../../../components/TaskWidget';
import { Search, Filter, RefreshCw, X, Bell, CheckCircle } from 'lucide-react';

export default function TasksPage() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
    const [filter, setFilter] = useState<'all' | 'today' | 'active' | 'done'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchTasks = useCallback(async (silent = false) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!silent) setIsRefreshing(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            if (!silent) setIsRefreshing(false);
        }
    }, []);

    // Initial load and periodic polling (every 10s) for immediate synchronization with Telegram
    useEffect(() => {
        fetchTasks();
        const interval = setInterval(() => {
            fetchTasks(true);
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchTasks]);

    // Handle Toggle Done / Reopen
    const handleToggleTask = async (id: string) => {
        const target = tasks.find(t => t.id === id);
        if (!target) return;

        const isCurrentlyDone = target.status === 'done' || target.status === 'DONE';
        const endpoint = isCurrentlyDone ? 'reopen' : 'done';

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.id === id) {
                return {
                    ...t,
                    status: isCurrentlyDone ? 'TODO' : 'DONE',
                    reminder: isCurrentlyDone
                        ? t.reminder
                        : (t.reminder ? { ...t.reminder, isEnabled: false, nextReminderAt: null } : null)
                };
            }
            return t;
        }));

        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/tasks/${id}/${endpoint}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const updated = await res.json();
                setTasks(prev => prev.map(t => t.id === id ? updated : t));
            } else {
                fetchTasks(true);
            }
        } catch (error) {
            console.error('Toggle task error:', error);
            fetchTasks(true);
        }
    };

    // Handle Delete Task
    const handleDeleteTask = async (id: string) => {
        if (!confirm('Ushbu vazifani o‘chirishni xohlaysizmi?')) return;

        setTasks(prev => prev.filter(t => t.id !== id));

        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            await fetch(`${apiUrl}/tasks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Delete task error:', error);
            fetchTasks(true);
        }
    };

    // Handle Reminder Action (Pause, Resume, Snooze)
    const handleReminderAction = async (taskId: string, action: { type: string; minutes?: number; nextTime?: string }) => {
        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/tasks/${taskId}/reminder`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(action)
            });
            if (res.ok) {
                const updated = await res.json();
                setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
            }
        } catch (error) {
            console.error('Reminder action error:', error);
        }
    };

    // Saved from Create / Edit form
    const handleTaskSaved = (savedTask: TaskItem) => {
        if (editingTask) {
            setTasks(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
            setEditingTask(null);
        } else {
            setTasks(prev => [savedTask, ...prev]);
        }
        fetchTasks(true);
    };

    // Filter tasks
    const filteredTasks = tasks.filter(t => {
        const isDone = t.status === 'done' || t.status === 'DONE';

        // Filter tab
        if (filter === 'active' && isDone) return false;
        if (filter === 'done' && !isDone) return false;
        if (filter === 'today') {
            if (!t.startAt) return true;
            const today = new Date().toDateString();
            const d = new Date(t.startAt).toDateString();
            if (today !== d) return false;
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = t.title?.toLowerCase().includes(q);
            const matchDesc = t.description?.toLowerCase().includes(q);
            if (!matchTitle && !matchDesc) return false;
        }

        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Vazifalar & Individual Eslatmalar</h1>
                    <p className="text-sm text-gray-500 font-medium">
                        Har bir vazifa uchun mustaqil interval va eslatma sozlamalari
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchTasks()}
                    disabled={isRefreshing}
                    className="self-start sm:self-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-gray-400'} />
                    Yangilash (Telegram bilan sinxron)
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
                {/* Search */}
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Vazifa nomi yoki tavsif bo‘yicha qidirish..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50/70 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100/70 p-1 rounded-xl">
                    {[
                        { id: 'all', label: 'Barchasi' },
                        { id: 'today', label: 'Bugun' },
                        { id: 'active', label: 'Faol' },
                        { id: 'done', label: 'Bajarilgan' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filter === tab.id
                                    ? 'bg-white text-blue-600 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Create Task Form (Sticky on desktop) */}
                <div className="lg:col-span-5 lg:sticky lg:top-6">
                    <TaskForm onSave={handleTaskSaved} />
                </div>

                {/* Right: Task List with Individual Reminder Statuses */}
                <div className="lg:col-span-7">
                    <TaskWidget
                        tasks={filteredTasks}
                        onToggle={handleToggleTask}
                        onDelete={handleDeleteTask}
                        onEdit={(task) => setEditingTask(task)}
                        onReminderAction={handleReminderAction}
                    />
                </div>
            </div>

            {/* Edit Task Modal */}
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs overflow-y-auto">
                    <div className="relative w-full max-w-xl my-8">
                        <TaskForm
                            initialTask={editingTask}
                            onSave={handleTaskSaved}
                            onCancel={() => setEditingTask(null)}
                            isEditing={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
