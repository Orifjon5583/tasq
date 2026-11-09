import cron from 'node-cron';
import { prisma } from '../app';
import { bot } from '../bot/instance';
import { TaskService } from './taskService';
import { ChartService } from './chartService';
import { StatsService } from './statsService';
import { TaskStatus, ReminderType, NotificationChannel, NotificationType } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { Markup } from 'telegraf';

// Asia/Tashkent timezone formatter
export function formatInTashkent(date: Date, includeDate: boolean = false): string {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Tashkent',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    if (includeDate) {
        options.day = '2-digit';
        options.month = '2-digit';
        options.year = 'numeric';
    }
    return new Intl.DateTimeFormat('uz-UZ', options).format(date);
}

export class SchedulerService {
    private static isProcessingReminders = false;

    static init() {
        console.log('Initializing SchedulerService with Asia/Tashkent timezone...');

        // 1. Core Persistent Task Reminder Job - Runs EVERY MINUTE
        cron.schedule('* * * * *', async () => {
            await SchedulerService.processDueReminders();
        });

        // 2. Daily Plan Notification at 08:00 (Asia/Tashkent)
        cron.schedule('0 8 * * *', async () => {
            console.log('Running 08:00 Daily Plan Job');
            try {
                const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });
                for (const user of users) {
                    if (!user.telegramChatId) continue;

                    const today = new Date();
                    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
                    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

                    const tasks = await prisma.task.findMany({
                        where: {
                            userId: user.id,
                            planned: true,
                            startAt: { gte: startOfToday, lte: endOfToday },
                            status: { not: TaskStatus.DONE }
                        },
                        orderBy: { startAt: 'asc' }
                    });

                    if (tasks.length > 0) {
                        let msg = `📅 **Bugungi reja (${formatInTashkent(new Date(), true)})**:\n\n`;
                        tasks.forEach(t => {
                            const time = t.startAt ? formatInTashkent(t.startAt) : '??:??';
                            const icon = t.priority === 'IMPORTANT' ? '🔴' : t.priority === 'NORMAL' ? '🟠' : '🔵';
                            msg += `${time} - ${t.title} (${t.durationMinutes} daq) ${icon}\n`;
                        });
                        await bot.telegram.sendMessage(user.telegramChatId, msg, { parse_mode: 'Markdown' });
                    } else {
                        await bot.telegram.sendMessage(user.telegramChatId, `📅 Bugunga reja yo‘q. /plan qilib rejalashtiring.`);
                    }
                }
            } catch (err) {
                console.error('Error running daily plan job:', err);
            }
        });

        // 3. Gap Reminders (10, 12, 14, 16, 18)
        const gapTimes = ['0 10 * * *', '0 12 * * *', '0 14 * * *', '0 16 * * *', '0 18 * * *'];
        gapTimes.forEach(time => {
            cron.schedule(time, async () => {
                console.log(`Running Gap Check Job at ${time}`);
                try {
                    const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });
                    for (const user of users) {
                        if (!user.telegramChatId) continue;
                        const gaps = await TaskService.getWorkGaps(user.id, new Date());
                        const currentHour = new Date().getHours();
                        const futureGaps = gaps.filter(g => g.start.getHours() >= currentHour);

                        if (futureGaps.length > 0) {
                            const firstGap = futureGaps[0];
                            const start = formatInTashkent(firstGap.start);
                            const end = formatInTashkent(firstGap.end);
                            const msg = `🔔 Eslatma: Bugun ${start}–${end} oralig‘ida bo‘sh vaqt bor. Biror nima rejalashtiring yoki dam oling!`;
                            await bot.telegram.sendMessage(user.telegramChatId, msg);
                        }
                    }
                } catch (err) {
                    console.error('Error running gap check:', err);
                }
            });
        });

        // 4. Late Tasks at 20:00
        cron.schedule('0 20 * * *', async () => {
            try {
                const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });
                for (const user of users) {
                    if (!user.telegramChatId) continue;
                    const overdueTasks = await prisma.task.findMany({
                        where: {
                            userId: user.id,
                            status: { not: TaskStatus.DONE },
                            dueAt: { lt: new Date() }
                        }
                    });

                    if (overdueTasks.length > 0) {
                        let msg = `⚠️ **Kechikkan vazifalar**:\n`;
                        overdueTasks.forEach(t => msg += `- ${t.title}\n`);
                        await bot.telegram.sendMessage(user.telegramChatId, msg, { parse_mode: 'Markdown' });
                    }
                }
            } catch (err) {
                console.error('Error checking late tasks:', err);
            }
        });

        // 5. Weekly Report Sunday 19:00
        cron.schedule('0 19 * * 0', async () => {
            try {
                const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } } });
                for (const user of users) {
                    if (!user.telegramChatId) continue;
                    await bot.telegram.sendMessage(user.telegramChatId, "📊 Haftalik hisobot tayyorlanmoqda...");

                    try {
                        const stats = await StatsService.getWeeklyTaskStats(user.id);
                        const labels = stats.dailyCounts.map(d => d.date);
                        const data = stats.dailyCounts.map(d => d.count);

                        if (stats.totalDone === 0) {
                            await bot.telegram.sendMessage(user.telegramChatId, "Bu hafta hech qanday task bajarilmadi. Keyingi hafta omad!");
                        } else {
                            const buffer = await ChartService.generateLineChart('Weekly Tasks', labels, data);
                            await bot.telegram.sendPhoto(user.telegramChatId, { source: buffer }, { caption: `Haftalik natija: ${stats.totalDone} ta task bajarildi.` });
                        }
                    } catch (error) {
                        console.error('Weekly report error:', error);
                        await bot.telegram.sendMessage(user.telegramChatId, "Hisobotni shakllantirishda xatolik yuz berdi.");
                    }
                }
            } catch (err) {
                console.error('Error running weekly report:', err);
            }
        });
    }

    /**
     * Process all due individual reminders across all tasks.
     * Prevents race conditions and duplicate triggers.
     */
    static async processDueReminders() {
        if (this.isProcessingReminders) {
            return;
        }
        this.isProcessingReminders = true;

        try {
            const now = new Date();

            // Find all active reminders where nextReminderAt <= now
            const dueReminders = await prisma.reminderSettings.findMany({
                where: {
                    isEnabled: true,
                    isPaused: false,
                    nextReminderAt: { lte: now },
                    task: {
                        status: { not: TaskStatus.DONE },
                        user: { telegramChatId: { not: null } }
                    }
                },
                include: {
                    task: {
                        include: {
                            user: true
                        }
                    }
                }
            });

            if (dueReminders.length === 0) {
                return;
            }

            console.log(`[SchedulerService] Found ${dueReminders.length} due reminder(s) at ${now.toISOString()}`);

            const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

            for (const reminder of dueReminders) {
                const task = reminder.task;
                const user = task.user;

                // Reliability check 0: Eslatma yuborish mumkin yoki yo'q (User reminder permission)
                if (!user.allowReminders) {
                    continue;
                }

                // Reliability check 0.1: Dars rejimi (Lesson Mode: do not disturb during class)
                if (user.lessonMode) {
                    console.log(`User ${user.id} is in Lesson Mode (Dars rejimi faol). Skipping reminder.`);
                    continue;
                }

                // Reliability check 1: Task completed? Stop immediately!
                if (task.status === TaskStatus.DONE) {
                    await prisma.reminderSettings.update({
                        where: { id: reminder.id },
                        data: { isEnabled: false, nextReminderAt: null }
                    });
                    continue;
                }

                // Reliability check 2: Stop at deadline condition
                if (reminder.stopAtDeadline && task.dueAt && now >= task.dueAt) {
                    console.log(`Task ${task.id} reached deadline (${task.dueAt}). Stopping reminders.`);
                    await prisma.reminderSettings.update({
                        where: { id: reminder.id },
                        data: { isEnabled: false, nextReminderAt: null }
                    });
                    continue;
                }

                // Reliability check 3: Max reminders condition
                if (reminder.maxReminders && reminder.sentCount >= reminder.maxReminders) {
                    console.log(`Task ${task.id} reached max reminders (${reminder.maxReminders}). Stopping.`);
                    await prisma.reminderSettings.update({
                        where: { id: reminder.id },
                        data: { isEnabled: false, nextReminderAt: null }
                    });
                    continue;
                }

                // Reliability check 4: Snoozed condition
                if (reminder.snoozedUntil && now < reminder.snoozedUntil) {
                    continue;
                }

                // Reliability check 5: Prevent duplicate notifications (at least 45s between notifications)
                if (reminder.lastReminderAt && (now.getTime() - reminder.lastReminderAt.getTime()) < 45000) {
                    continue;
                }

                // Format notification message in Asia/Tashkent timezone
                const startTimeStr = task.startAt ? formatInTashkent(task.startAt, true) : 'Belgilanmagan';
                const dueTimeStr = task.dueAt ? formatInTashkent(task.dueAt, true) : 'Belgilanmagan';
                const currentCount = reminder.sentCount + 1;

                let intervalDesc = 'Bir martalik';
                if (reminder.reminderType === ReminderType.REPEATED || reminder.reminderType === ReminderType.CUSTOM) {
                    intervalDesc = `Har ${reminder.intervalMinutes || 20} daqiqada (№${currentCount})`;
                }

                const message =
                    `⏰ **ESLATMA: ${task.title}**\n\n` +
                    `📋 **Vazifa**: ${task.title}\n` +
                    (task.description ? `📝 **Tavsif**: ${task.description}\n` : '') +
                    `🕒 **Boshlanish vaqti**: ${startTimeStr}\n` +
                    `⏳ **Muddat (Deadline)**: ${dueTimeStr}\n` +
                    `🔄 **Tartib**: ${intervalDesc}\n\n` +
                    `_Quyidagi tugmalar orqali eslatmani boshqarishingiz mumkin:_`;

                // Section 4 Telegram Inline Buttons:
                // - Mark as completed
                // - Remind me again in 20 minutes
                // - Remind me again in 1 hour
                // - Pause reminders
                // - Open task
                const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
                const isRealHttpUrl = appBaseUrl.startsWith('https://') && !appBaseUrl.includes('localhost') && !appBaseUrl.includes('127.0.0.1');

                const openTaskButton = isRealHttpUrl
                    ? Markup.button.url('📋 Vazifani ochish', `${appBaseUrl}/dashboard/tasks?id=${task.id}`)
                    : Markup.button.callback('📋 Vazifani ochish', `reminder:open:${task.id}`);

                const keyboard = Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Bajarildi deb belgilash', `reminder:done:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏰ 20 daqiqadan so‘ng', `reminder:snooze:20:${task.id}`),
                        Markup.button.callback('⏰ 1 soatdan so‘ng', `reminder:snooze:60:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏸ Eslatmani pauza qilish', `reminder:pause:${task.id}`),
                        openTaskButton
                    ]
                ]);

                try {
                    // Send to Telegram user
                    await bot.telegram.sendMessage(user.telegramChatId!, message, {
                        parse_mode: 'Markdown',
                        ...keyboard
                    });

                    // Log SUCCESS
                    await prisma.notificationLog.create({
                        data: {
                            userId: user.id,
                            taskId: task.id,
                            channel: NotificationChannel.TELEGRAM,
                            type: NotificationType.TASK_REMINDER,
                            status: 'SENT',
                            sentAt: now,
                            meta: {
                                chatId: user.telegramChatId,
                                sentCount: currentCount,
                                reminderType: reminder.reminderType,
                                intervalMinutes: reminder.intervalMinutes
                            }
                        }
                    });

                    // Calculate next reminder
                    let nextTime: Date | null = null;
                    let shouldStayEnabled = true;

                    if (reminder.reminderType === ReminderType.ONCE) {
                        // One-time reminder is done
                        nextTime = null;
                        shouldStayEnabled = false;
                    } else if (reminder.reminderType === ReminderType.REPEATED || reminder.reminderType === ReminderType.CUSTOM) {
                        const interval = reminder.intervalMinutes || 20;
                        nextTime = addMinutes(now, interval);

                        // Check deadline stopping condition
                        if (reminder.stopAtDeadline && task.dueAt && nextTime > task.dueAt) {
                            nextTime = null;
                            shouldStayEnabled = false;
                        }

                        // Check max reminders condition
                        if (reminder.maxReminders && currentCount >= reminder.maxReminders) {
                            nextTime = null;
                            shouldStayEnabled = false;
                        }
                    }

                    // Update ReminderSettings persistently
                    await prisma.reminderSettings.update({
                        where: { id: reminder.id },
                        data: {
                            sentCount: { increment: 1 },
                            lastReminderAt: now,
                            nextReminderAt: nextTime,
                            isEnabled: shouldStayEnabled && nextTime !== null,
                            snoozedUntil: null
                        }
                    });

                    console.log(`[SchedulerService] Reminder sent for task ${task.id}. Next: ${nextTime?.toISOString() || 'NONE'}`);
                } catch (error: any) {
                    console.error(`[SchedulerService] Telegram API error for task ${task.id}:`, error);

                    // Log FAILURE
                    await prisma.notificationLog.create({
                        data: {
                            userId: user.id,
                            taskId: task.id,
                            channel: NotificationChannel.TELEGRAM,
                            type: NotificationType.TASK_REMINDER,
                            status: 'FAILED',
                            error: error?.message || String(error),
                            sentAt: now,
                            meta: {
                                chatId: user.telegramChatId,
                                reminderType: reminder.reminderType
                            }
                        }
                    });

                    // Reschedule for 5 minutes later so it doesn't loop infinitely on error
                    await prisma.reminderSettings.update({
                        where: { id: reminder.id },
                        data: {
                            nextReminderAt: addMinutes(now, 5)
                        }
                    });
                }
            }
        } catch (globalErr) {
            console.error('[SchedulerService] Error in processDueReminders:', globalErr);
        } finally {
            this.isProcessingReminders = false;
        }
    }
}
