import { PrismaClient, Task, TaskPriority, TaskStatus, ReminderType } from '@prisma/client';
import { prisma } from '../app';
import { startOfDay, endOfDay, addMinutes, isBefore, isAfter } from 'date-fns';

export interface TaskReminderInput {
    reminderType: ReminderType;
    intervalMinutes?: number | null;
    firstReminderAt?: string | Date | null;
    nextReminderAt?: string | Date | null;
    stopAtDeadline?: boolean;
    maxReminders?: number | null;
    isEnabled?: boolean;
    isPaused?: boolean;
    snoozedUntil?: string | Date | null;
}

export class TaskService {
    static async create(userId: string, data: {
        title: string;
        description?: string;
        priority?: TaskPriority;
        durationMinutes?: number;
        startAt?: string | Date;
        dueAt?: string | Date;
        reminder?: TaskReminderInput;
    }) {
        const priority = data.priority || TaskPriority.NORMAL;
        const durationMinutes = data.durationMinutes || 60;
        let start: Date | undefined;
        let end: Date | undefined;
        let planned = false;

        if (data.startAt) {
            start = new Date(data.startAt);
            end = addMinutes(start, durationMinutes);
            planned = true;

            const hasOverlap = await this.checkOverlap(userId, start, end);
            if (hasOverlap) {
                // If overlap exists, log warning but don't strictly crash unless needed
                console.warn(`Time slot overlaps with existing task for user ${userId}`);
            }
        }

        const dueAt = data.dueAt ? new Date(data.dueAt) : undefined;

        // Reminder calculation
        const reminderInput = data.reminder;
        let reminderCreateData: any = undefined;

        if (reminderInput && reminderInput.reminderType && reminderInput.reminderType !== ReminderType.NONE) {
            const reminderType = reminderInput.reminderType;
            const intervalMinutes = reminderInput.intervalMinutes ?? (reminderType === ReminderType.REPEATED || reminderType === ReminderType.CUSTOM ? 20 : null);
            
            let firstReminderDate: Date | null = null;
            if (reminderInput.firstReminderAt) {
                firstReminderDate = new Date(reminderInput.firstReminderAt);
            } else if (start) {
                firstReminderDate = new Date(start);
            }

            // Next reminder determination
            let nextReminderDate: Date | null = null;
            if (firstReminderDate) {
                nextReminderDate = new Date(firstReminderDate);
            } else if (intervalMinutes) {
                nextReminderDate = addMinutes(new Date(), intervalMinutes);
            }

            // If stop at deadline and next reminder is already after deadline
            if (reminderInput.stopAtDeadline && dueAt && nextReminderDate && nextReminderDate > dueAt) {
                nextReminderDate = null;
            }

            reminderCreateData = {
                reminderType,
                intervalMinutes,
                firstReminderAt: firstReminderDate,
                nextReminderAt: nextReminderDate,
                stopAtDeadline: reminderInput.stopAtDeadline !== false,
                maxReminders: reminderInput.maxReminders ?? null,
                isEnabled: nextReminderDate !== null,
                isPaused: false,
                sentCount: 0
            };
        } else {
            // Task has default NONE reminder settings so every task has individual reminder settings
            reminderCreateData = {
                reminderType: ReminderType.NONE,
                isEnabled: false,
                isPaused: false,
                stopAtDeadline: true,
                sentCount: 0
            };
        }

        return prisma.task.create({
            data: {
                userId,
                title: data.title,
                description: data.description,
                priority,
                durationMinutes,
                startAt: start,
                endAt: end,
                dueAt,
                planned,
                status: TaskStatus.TODO,
                reminder: {
                    create: reminderCreateData
                }
            },
            include: {
                reminder: true
            }
        });
    }

    static async update(userId: string, taskId: string, data: {
        title?: string;
        description?: string;
        priority?: TaskPriority;
        durationMinutes?: number;
        startAt?: string | Date | null;
        dueAt?: string | Date | null;
        status?: TaskStatus;
        reminder?: Partial<TaskReminderInput>;
    }) {
        const existing = await prisma.task.findFirst({
            where: { id: taskId, userId },
            include: { reminder: true }
        });

        if (!existing) {
            throw new Error('Vazifa topilmadi');
        }

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;

        const duration = data.durationMinutes ?? existing.durationMinutes;

        if (data.startAt !== undefined) {
            if (data.startAt) {
                const start = new Date(data.startAt);
                updateData.startAt = start;
                updateData.endAt = addMinutes(start, duration);
                updateData.planned = true;
            } else {
                updateData.startAt = null;
                updateData.endAt = null;
                updateData.planned = false;
            }
        }

        if (data.dueAt !== undefined) {
            updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
        }

        if (data.status !== undefined) {
            updateData.status = data.status;
            if (data.status === TaskStatus.DONE && !existing.actualMinutes) {
                updateData.actualMinutes = duration;
            }
        }

        // Apply task updates first
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: updateData
        });

        // Handle Reminder updates
        const isNowDone = (data.status === TaskStatus.DONE) || (data.status === undefined && existing.status === TaskStatus.DONE);
        const effectiveDueAt = data.dueAt !== undefined ? (data.dueAt ? new Date(data.dueAt) : null) : existing.dueAt;

        if (isNowDone) {
            // Stop reminders immediately
            if (existing.reminder) {
                await prisma.reminderSettings.update({
                    where: { taskId },
                    data: {
                        isEnabled: false,
                        nextReminderAt: null
                    }
                });
            }
        } else if (data.reminder) {
            const r = data.reminder;
            const newReminderType = r.reminderType ?? existing.reminder?.reminderType ?? ReminderType.NONE;

            let nextReminderAt = existing.reminder?.nextReminderAt ?? null;
            let firstReminderAt = existing.reminder?.firstReminderAt ?? null;

            if (r.firstReminderAt !== undefined) {
                firstReminderAt = r.firstReminderAt ? new Date(r.firstReminderAt) : null;
                // If first reminder changed, recalculate next reminder
                if (firstReminderAt && firstReminderAt > new Date()) {
                    nextReminderAt = firstReminderAt;
                }
            }

            if (r.nextReminderAt !== undefined) {
                nextReminderAt = r.nextReminderAt ? new Date(r.nextReminderAt) : null;
            }

            const intervalMinutes = r.intervalMinutes !== undefined ? r.intervalMinutes : existing.reminder?.intervalMinutes;

            let isEnabled = r.isEnabled !== undefined ? r.isEnabled : (existing.reminder?.isEnabled ?? (newReminderType !== ReminderType.NONE));
            let isPaused = r.isPaused !== undefined ? r.isPaused : (existing.reminder?.isPaused ?? false);

            if (newReminderType === ReminderType.NONE) {
                isEnabled = false;
                nextReminderAt = null;
            } else if (isEnabled && !isPaused && (!nextReminderAt || nextReminderAt <= new Date())) {
                if (firstReminderAt && firstReminderAt > new Date()) {
                    nextReminderAt = firstReminderAt;
                } else if (intervalMinutes) {
                    nextReminderAt = addMinutes(new Date(), intervalMinutes);
                } else if (newReminderType === ReminderType.ONCE && updatedTask.startAt && updatedTask.startAt > new Date()) {
                    nextReminderAt = updatedTask.startAt;
                }
            }

            const stopAtDeadline = r.stopAtDeadline !== undefined ? r.stopAtDeadline : (existing.reminder?.stopAtDeadline ?? true);
            if (stopAtDeadline && effectiveDueAt && nextReminderAt && nextReminderAt > effectiveDueAt) {
                nextReminderAt = null;
                isEnabled = false;
            }

            await prisma.reminderSettings.upsert({
                where: { taskId },
                create: {
                    taskId,
                    reminderType: newReminderType,
                    intervalMinutes: intervalMinutes ?? null,
                    firstReminderAt,
                    nextReminderAt,
                    isEnabled,
                    isPaused,
                    stopAtDeadline,
                    maxReminders: r.maxReminders !== undefined ? r.maxReminders : null,
                    sentCount: 0
                },
                update: {
                    reminderType: newReminderType,
                    intervalMinutes: intervalMinutes ?? null,
                    firstReminderAt,
                    nextReminderAt,
                    isEnabled,
                    isPaused,
                    stopAtDeadline,
                    maxReminders: r.maxReminders !== undefined ? r.maxReminders : existing.reminder?.maxReminders,
                    snoozedUntil: r.snoozedUntil !== undefined ? (r.snoozedUntil ? new Date(r.snoozedUntil) : null) : existing.reminder?.snoozedUntil
                }
            });
        } else if (data.status === TaskStatus.TODO && existing.status === TaskStatus.DONE) {
            // Task was reopened! Re-enable reminder if it had one
            if (existing.reminder && existing.reminder.reminderType !== ReminderType.NONE) {
                const interval = existing.reminder.intervalMinutes || 20;
                await prisma.reminderSettings.update({
                    where: { taskId },
                    data: {
                        isEnabled: true,
                        isPaused: false,
                        nextReminderAt: addMinutes(new Date(), interval),
                        snoozedUntil: null
                    }
                });
            }
        }

        return prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });
    }

    static async markDone(userId: string, taskId: string) {
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId }
        });
        if (!task) throw new Error('Vazifa topilmadi');

        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: TaskStatus.DONE,
                actualMinutes: task.durationMinutes || 60
            }
        });

        // Immediately stop reminders
        await prisma.reminderSettings.updateMany({
            where: { taskId },
            data: {
                isEnabled: false,
                nextReminderAt: null
            }
        });

        return prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });
    }

    static async reopen(userId: string, taskId: string) {
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
            include: { reminder: true }
        });
        if (!task) throw new Error('Vazifa topilmadi');

        await prisma.task.update({
            where: { id: taskId },
            data: { status: TaskStatus.TODO }
        });

        if (task.reminder && task.reminder.reminderType !== ReminderType.NONE) {
            const interval = task.reminder.intervalMinutes || 20;
            await prisma.reminderSettings.update({
                where: { taskId },
                data: {
                    isEnabled: true,
                    isPaused: false,
                    nextReminderAt: addMinutes(new Date(), interval),
                    snoozedUntil: null
                }
            });
        }

        return prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });
    }

    static async updateReminderControl(userId: string, taskId: string, action: {
        type: 'pause' | 'resume' | 'snooze' | 'disable' | 'enable' | 'set_interval' | 'set_next_time';
        minutes?: number;
        nextTime?: string | Date;
    }) {
        const task = await prisma.task.findFirst({
            where: { id: taskId, userId },
            include: { reminder: true }
        });
        if (!task) throw new Error('Vazifa topilmadi');

        let reminder = task.reminder;
        if (!reminder) {
            reminder = await prisma.reminderSettings.create({
                data: {
                    taskId,
                    reminderType: ReminderType.REPEATED,
                    intervalMinutes: 20,
                    isEnabled: true,
                    isPaused: false
                }
            });
        }

        const now = new Date();
        const updateData: any = {};

        switch (action.type) {
            case 'pause':
                updateData.isPaused = true;
                break;
            case 'resume':
                updateData.isPaused = false;
                updateData.isEnabled = true;
                updateData.nextReminderAt = addMinutes(now, reminder.intervalMinutes || 20);
                updateData.snoozedUntil = null;
                break;
            case 'snooze':
                const snoozeMins = action.minutes || 20;
                const snoozeTarget = addMinutes(now, snoozeMins);
                updateData.snoozedUntil = snoozeTarget;
                updateData.nextReminderAt = snoozeTarget;
                updateData.isEnabled = true;
                updateData.isPaused = false;
                break;
            case 'disable':
                updateData.isEnabled = false;
                updateData.nextReminderAt = null;
                break;
            case 'enable':
                updateData.isEnabled = true;
                updateData.isPaused = false;
                updateData.nextReminderAt = addMinutes(now, reminder.intervalMinutes || 20);
                break;
            case 'set_interval':
                if (action.minutes && action.minutes > 0) {
                    updateData.intervalMinutes = action.minutes;
                    if (reminder.isEnabled && !reminder.isPaused) {
                        updateData.nextReminderAt = addMinutes(now, action.minutes);
                    }
                }
                break;
            case 'set_next_time':
                if (action.nextTime) {
                    updateData.nextReminderAt = new Date(action.nextTime);
                    updateData.isEnabled = true;
                }
                break;
        }

        await prisma.reminderSettings.update({
            where: { id: reminder.id },
            data: updateData
        });

        return prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });
    }

    static async checkOverlap(userId: string, start: Date, end: Date, excludeTaskId?: string): Promise<boolean> {
        const overlappingTask = await prisma.task.findFirst({
            where: {
                userId,
                planned: true,
                id: excludeTaskId ? { not: excludeTaskId } : undefined,
                status: { not: TaskStatus.DONE },
                AND: [
                    { startAt: { lt: end } },
                    { endAt: { gt: start } }
                ]
            }
        });
        return !!overlappingTask;
    }

    static async getWorkGaps(userId: string, date: Date) {
        const workStartHour = 8;
        const workEndHour = 22;

        const dayStart = startOfDay(date);
        const workStart = new Date(dayStart); workStart.setHours(workStartHour, 0, 0, 0);
        const workEnd = new Date(dayStart); workEnd.setHours(workEndHour, 0, 0, 0);

        const tasks = await prisma.task.findMany({
            where: {
                userId,
                planned: true,
                startAt: { gte: workStart, lt: workEnd },
                status: { not: TaskStatus.DONE }
            },
            orderBy: { startAt: 'asc' }
        });

        const gaps: { start: Date, end: Date, duration: number }[] = [];
        let lastEnd = workStart;

        for (const task of tasks) {
            if (!task.startAt) continue;
            const gapDuration = (task.startAt.getTime() - lastEnd.getTime()) / (1000 * 60);
            if (gapDuration >= 60) {
                gaps.push({ start: lastEnd, end: task.startAt, duration: gapDuration });
            }
            if (task.endAt && isAfter(task.endAt, lastEnd)) {
                lastEnd = task.endAt;
            }
        }

        const finalGapDuration = (workEnd.getTime() - lastEnd.getTime()) / (1000 * 60);
        if (finalGapDuration >= 60) {
            gaps.push({ start: lastEnd, end: workEnd, duration: finalGapDuration });
        }

        return gaps;
    }

    static async autoPlan(userId: string, date: Date) {
        const gaps = await this.getWorkGaps(userId, date);

        const backlog = await prisma.task.findMany({
            where: {
                userId,
                planned: false,
                status: TaskStatus.TODO
            }
        });

        const priorityOrder = { [TaskPriority.IMPORTANT]: 0, [TaskPriority.NORMAL]: 1, [TaskPriority.FUTURE]: 2 };
        backlog.sort((a: Task, b: Task) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        const plannedTasks = [];

        for (const task of backlog) {
            for (const gap of gaps) {
                if (gap.duration >= task.durationMinutes) {
                    const newStart = gap.start;
                    const newEnd = addMinutes(newStart, task.durationMinutes);

                    await prisma.task.update({
                        where: { id: task.id },
                        data: {
                            planned: true,
                            startAt: newStart,
                            endAt: newEnd
                        }
                    });

                    plannedTasks.push(task);
                    gap.start = newEnd;
                    gap.duration -= task.durationMinutes;
                    break;
                }
            }
        }
        return {
            planned: plannedTasks.length,
            leftover: backlog.length - plannedTasks.length
        };
    }
}
