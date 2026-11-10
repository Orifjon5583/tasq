import { Context, Markup } from 'telegraf';
import { bot } from './instance'; // Imported from instance to avoid circular dependency
import { TaskService } from '../services/taskService';
import { StatsService } from '../services/statsService';
import { ChartService } from '../services/chartService';
import { FinanceService } from '../services/financeService';
import { formatInTashkent } from '../services/schedulerService';
import { prisma } from '../app';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { addMinutes, format } from 'date-fns';

// Extract user ID helper
export const getUserId = async (ctx: Context) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return null;
    let user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) {
        // Fallback: if only one user with tasks exists or latest active user
        const userWithTasks = await prisma.user.findFirst({
            where: { tasks: { some: {} } },
            orderBy: { updatedAt: 'desc' }
        });
        if (userWithTasks) {
            await prisma.user.updateMany({
                where: { telegramChatId: chatId, id: { not: userWithTasks.id } },
                data: { telegramChatId: null }
            });
            user = await prisma.user.update({
                where: { id: userWithTasks.id },
                data: { telegramChatId: chatId }
            });
        }
    }
    return user?.id;
};

// Shared helper to send today's and active tasks
export const sendTodayTasks = async (ctx: Context) => {
    const userId = await getUserId(ctx);
    if (!userId) {
        return ctx.reply('⚠️ Hisobingiz sayt bilan bog‘lanmagan.\n\nBog‘lash uchun botga: `/link sizning_emailingiz` deb yozing (Masalan: `/link user@gmail.com`).', { parse_mode: 'Markdown' });
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // 1. Bugungi rejalashtirilgan vazifalar
    const todayTasks = await prisma.task.findMany({
        where: {
            userId,
            planned: true,
            startAt: { gte: startOfToday, lte: endOfToday }
        },
        include: { reminder: true },
        orderBy: { startAt: 'asc' }
    });

    // 2. Barcha boshqa faol (bajarilmagan) vazifalar
    const otherTasks = await prisma.task.findMany({
        where: {
            userId,
            status: { not: TaskStatus.DONE },
            id: { notIn: todayTasks.map(t => t.id) }
        },
        include: { reminder: true },
        orderBy: { createdAt: 'desc' }
    });

    if (todayTasks.length === 0 && otherTasks.length === 0) {
        return ctx.reply('📋 **Vazifalar ro‘yxati**:\n\n(Hozircha faol vazifalar yo‘q. Saytdan yoki /add orqali yangi vazifa qo‘shishingiz mumkin)');
    }

    let msg = `📋 **Sizning Vazifalaringiz**:\n\n`;

    if (todayTasks.length > 0) {
        msg += `📅 **Bugungi Reja**:\n`;
        todayTasks.forEach((t: any) => {
            const time = t.startAt ? formatInTashkent(t.startAt) : '??:??';
            const icon = t.status === TaskStatus.DONE ? '✅' : t.priority === TaskPriority.IMPORTANT ? '🔴' : t.priority === TaskPriority.NORMAL ? '🟠' : '🔵';
            const reminderInfo = t.reminder && t.reminder.isEnabled ? ' 🔔' : '';
            msg += `${icon} ${time} - ${t.title} (${t.durationMinutes}m)${reminderInfo}\n`;
        });
        msg += `\n`;
    }

    if (otherTasks.length > 0) {
        msg += `📌 **Barcha Boshqa Faol Vazifalar**:\n`;
        otherTasks.forEach((t: any) => {
            const icon = t.priority === TaskPriority.IMPORTANT ? '🔴' : t.priority === TaskPriority.NORMAL ? '🟠' : '🔵';
            const timeStr = t.startAt ? ` (${formatInTashkent(t.startAt, true)})` : t.dueAt ? ` (Muddat: ${formatInTashkent(t.dueAt, true)})` : '';
            const reminderInfo = t.reminder && t.reminder.isEnabled ? ' 🔔' : '';
            msg += `${icon} ${t.title}${timeStr}${reminderInfo}\n`;
        });
    }

    await ctx.replyWithMarkdown(msg);
};

// /today
bot.command('today', sendTodayTasks);

// /link <email> - Instant account linking command
bot.command('link', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        return ctx.reply('⚠️ Iltimos, emailingizni kiriting:\nMasalan: `/link user@gmail.com`', { parse_mode: 'Markdown' });
    }
    const email = parts[1].toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return ctx.reply(`❌ Saytda bunday email (${email}) topilmadi.\nAvval https://personal.orifdev.uz saytida ro‘yxatdan o‘ting.`);
    }

    // Detach chatId from other users if attached
    await prisma.user.updateMany({
        where: { telegramChatId: chatId, id: { not: user.id } },
        data: { telegramChatId: null }
    });

    // Attach to this user
    await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId }
    });

    return ctx.reply(
        `✅ **Hisob muvaffaqiyatli bog‘landi!**\n\n` +
        `👤 **Foydalanuvchi**: ${user.name} (${user.email})\n` +
        `🆔 **Chat ID**: \`${chatId}\`\n\n` +
        `Endi saytdan reja yoki vazifa qo‘shganingizda, darhol botda ko‘rinadi va eslatmalar keladi!`,
        { parse_mode: 'Markdown' }
    );
});

// /plan
bot.command('plan', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const result = await TaskService.autoPlan(userId, new Date());
    ctx.reply(`✅ Rejalashtirish yakunlandi!\nRejalashtirilgan: ${result.planned}\nQoldirildi: ${result.leftover}`);
});

// /stats
bot.command('stats', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const stats = await StatsService.getWeeklyTaskStats(userId);
    const chartBuffer = await ChartService.generateWeeklyProgressChart(stats);

    ctx.replyWithPhoto({ source: chartBuffer }, { caption: '📊 Haftalik hisobot' });
});

// /add <title>
bot.command('add', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('⚠️ Iltimos, vazifa nomini kiriting. Masalan: /add Kitob o‘qish');

    await TaskService.create(userId, { title: text, priority: TaskPriority.NORMAL, durationMinutes: 30 });
    ctx.reply(`✅ Vazifa qo‘shildi: "${text}"`);
});

// /help
bot.command('help', (ctx) => {
    ctx.reply(
        `🤖 **Personal Planner Bot**\n\n` +
        `/today - Bugungi vazifalar\n` +
        `/add <nomi> - Tezkor vazifa qo‘shish\n` +
        `/plan - Kunni avtomatik rejalashtirish\n` +
        `/stats - Haftalik statistika\n` +
        `/start <kod> - Web hisobni bog‘lash`,
        Markup.keyboard([
            ['📊 Hisobot', '💰 Qolgan mablag‘'],
            ['📋 Vazifalar', '✅ Topshirilgan']
        ]).resize()
    );
});

// /done
bot.command('done', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('Auth required.');

    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
        where: { userId, status: TaskStatus.TODO, startAt: { gte: startOfToday, lte: endOfToday } },
        orderBy: { startAt: 'asc' }
    });

    if (tasks.length === 0) return ctx.reply('Bugunga bajarilmagan tasklar yo‘q.');

    const buttons = tasks.map((t: any) => [Markup.button.callback(`✅ ${t.title}`, `done:${t.id}`)]);
    ctx.reply('Qaysi taskni bajardingiz?', Markup.inlineKeyboard(buttons));
});

bot.action(/done:(.+)/, async (ctx) => {
    const taskId = ctx.match[1];
    await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.DONE }
    });
    // Immediately stop reminder
    await prisma.reminderSettings.updateMany({
        where: { taskId },
        data: { isEnabled: false, nextReminderAt: null }
    });
    ctx.answerCbQuery('Task bajarildi!');
    ctx.editMessageText('✅ Task DONE qilindi.');
});

// --- Section 4: Telegram Reminder Inline Buttons Handlers ---

const getOpenTaskButton = (taskId: string) => {
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const isRealHttpUrl = appBaseUrl.startsWith('https://') && !appBaseUrl.includes('localhost') && !appBaseUrl.includes('127.0.0.1');
    return isRealHttpUrl
        ? Markup.button.url('📋 Vazifani ochish', `${appBaseUrl}/dashboard/tasks?id=${taskId}`)
        : Markup.button.callback('📋 Vazifani ochish', `reminder:open:${taskId}`);
};

// 1. Mark as completed
bot.action(/^reminder:done:(.+)$/, async (ctx) => {
    try {
        const taskId = ctx.match[1];
        const task = await prisma.task.findUnique({
            where: { id: taskId }
        });
        if (!task) {
            await ctx.answerCbQuery('Vazifa topilmadi');
            return;
        }

        await prisma.task.update({
            where: { id: taskId },
            data: { status: TaskStatus.DONE }
        });
        await prisma.reminderSettings.updateMany({
            where: { taskId },
            data: { isEnabled: false, nextReminderAt: null }
        });

        await ctx.answerCbQuery('✅ Vazifa bajarildi!');
        await ctx.editMessageText(
            `✅ **Vazifa muvaffaqiyatli bajarildi!**\n\n` +
            `📋 **${task.title}**\n` +
            `Kelgusi barcha eslatmalar to‘xtatildi.`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('reminder:done error:', e);
        ctx.answerCbQuery('Xatolik yuz berdi');
    }
});

// 2. Snooze (20 min or 60 min or custom)
// "The snooze button must temporarily override the next reminder time without permanently changing the task's configured interval."
bot.action(/^reminder:snooze:(\d+):(.+)$/, async (ctx) => {
    try {
        const minutes = parseInt(ctx.match[1]);
        const taskId = ctx.match[2];

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });

        if (!task || !task.reminder) {
            await ctx.answerCbQuery('Eslatma topilmadi');
            return;
        }

        const now = new Date();
        const snoozeTarget = addMinutes(now, minutes);

        await prisma.reminderSettings.update({
            where: { id: task.reminder.id },
            data: {
                snoozedUntil: snoozeTarget,
                nextReminderAt: snoozeTarget,
                isEnabled: true,
                isPaused: false
            }
        });

        const formattedTarget = formatInTashkent(snoozeTarget);
        await ctx.answerCbQuery(`⏰ ${minutes} daqiqaga kechiktirildi`);

        const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        await ctx.editMessageText(
            `⏰ **Eslatma ${minutes} daqiqaga kechiktirildi.**\n\n` +
            `📋 **Vazifa**: ${task.title}\n` +
            `🕒 **Keyingi eslatma**: ${formattedTarget} da yuboriladi.\n` +
            `_(Asosiy sozlangan interval o‘zgarishsiz qoldi: Har ${task.reminder.intervalMinutes || 20} daqiqada)_`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Bajarildi deb belgilash', `reminder:done:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏰ +20 daqiqa', `reminder:snooze:20:${task.id}`),
                        Markup.button.callback('⏰ +1 soat', `reminder:snooze:60:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏸ Eslatmani pauza qilish', `reminder:pause:${task.id}`),
                        getOpenTaskButton(task.id)
                    ]
                ])
            }
        );
    } catch (e) {
        console.error('reminder:snooze error:', e);
        ctx.answerCbQuery('Xatolik yuz berdi');
    }
});

// 3. Pause reminders
bot.action(/^reminder:pause:(.+)$/, async (ctx) => {
    try {
        const taskId = ctx.match[1];
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });

        if (!task || !task.reminder) {
            await ctx.answerCbQuery('Eslatma topilmadi');
            return;
        }

        await prisma.reminderSettings.update({
            where: { id: task.reminder.id },
            data: { isPaused: true }
        });

        await ctx.answerCbQuery('⏸ Eslatmalar to‘xtatildi (pauza)');

        await ctx.editMessageText(
            `⏸ **Eslatmalar vaqtincha to‘xtatildi (Pauza).**\n\n` +
            `📋 **Vazifa**: ${task.title}\n` +
            `Istalgan vaqtda quyidagi tugma orqali eslatmalarni qayta davom ettirishingiz mumkin.`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('▶️ Qayta davom ettirish (Resume)', `reminder:resume:${task.id}`)
                    ],
                    [
                        Markup.button.callback('✅ Bajarildi deb belgilash', `reminder:done:${task.id}`)
                    ],
                    [
                        getOpenTaskButton(task.id)
                    ]
                ])
            }
        );
    } catch (e) {
        console.error('reminder:pause error:', e);
        ctx.answerCbQuery('Xatolik yuz berdi');
    }
});

// 4. Resume reminders
bot.action(/^reminder:resume:(.+)$/, async (ctx) => {
    try {
        const taskId = ctx.match[1];
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { reminder: true }
        });

        if (!task || !task.reminder) {
            await ctx.answerCbQuery('Eslatma topilmadi');
            return;
        }

        const interval = task.reminder.intervalMinutes || 20;
        const nextTime = addMinutes(new Date(), interval);

        await prisma.reminderSettings.update({
            where: { id: task.reminder.id },
            data: {
                isPaused: false,
                isEnabled: true,
                nextReminderAt: nextTime,
                snoozedUntil: null
            }
        });

        await ctx.answerCbQuery('▶️ Eslatmalar davom ettirildi');

        await ctx.editMessageText(
            `▶️ **Eslatmalar qayta davom ettirildi!**\n\n` +
            `📋 **Vazifa**: ${task.title}\n` +
            `🕒 **Keyingi eslatma**: ${formatInTashkent(nextTime)} da yuboriladi.\n` +
            `(Interval: Har ${interval} daqiqada)`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Bajarildi deb belgilash', `reminder:done:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏰ +20 daqiqa', `reminder:snooze:20:${task.id}`),
                        Markup.button.callback('⏰ +1 soat', `reminder:snooze:60:${task.id}`)
                    ],
                    [
                        Markup.button.callback('⏸ Eslatmani pauza qilish', `reminder:pause:${task.id}`),
                        getOpenTaskButton(task.id)
                    ]
                ])
            }
        );
    } catch (e) {
        console.error('reminder:resume error:', e);
        ctx.answerCbQuery('Xatolik yuz berdi');
    }
});

// 5. Open task callback
bot.action(/^reminder:open:(.+)$/, async (ctx) => {
    try {
        const taskId = ctx.match[1];
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        await ctx.answerCbQuery();
        await ctx.reply(
            `📋 **Vazifa Tafsilotlari**:\n\n` +
            `Sarlavha: ${task?.title}\n` +
            `Holati: ${task?.status}\n\n` +
            `Web-ilovada ochish: ${appUrl}/dashboard/tasks?id=${taskId}`
        );
    } catch (e) {
        console.error('reminder:open error:', e);
    }
});

// /chart week
bot.command('chart', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('Auth required.');

    const arg = (ctx.message as any).text.split(' ')[1];
    if (arg !== 'week') return ctx.reply('Faqat /chart week ishlaydi hozircha.');

    const stats = await StatsService.getWeeklyTaskStats(userId);
    const labels = stats.dailyCounts.map(d => d.date);
    const data = stats.dailyCounts.map(d => d.count);

    const buffer = await ChartService.generateLineChart('Weekly Done Tasks', labels, data);
    ctx.replyWithPhoto({ source: buffer }, { caption: 'Haftalik Bajarilgan Ishlar' });
});

// /gaps
bot.command('gaps', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('Auth required.');

    const gaps = await TaskService.getWorkGaps(userId, new Date());
    if (gaps.length === 0) return ctx.reply('Bugun bo‘sh vaqt (gap) qolmadi.');

    let msg = `🕰 **Bugungi Bo‘sh Vaqtlar**:\n`;
    gaps.forEach(g => {
        msg += `- ${format(g.start, 'HH:mm')} dan ${format(g.end, 'HH:mm')} gacha (${Math.round(g.duration)} daqiqa)\n`;
    });
    ctx.reply(msg);
});

// --- Menu & Extra Features ---
bot.command('menu', async (ctx) => {
    return ctx.reply('Asosiy menyu:', Markup.keyboard([
        ['📊 Hisobot', '💰 Qolgan mablag‘'],
        ['📋 Vazifalar', '✅ Topshirilgan']
    ]).resize());
});

bot.hears('Qo‘shimcha', async (ctx) => {
    return ctx.reply('Asosiy menyu:', Markup.keyboard([
        ['📊 Hisobot', '💰 Qolgan mablag‘'],
        ['📋 Vazifalar', '✅ Topshirilgan']
    ]).resize());
});

bot.hears('🔙 Orqaga', async (ctx) => {
    return ctx.reply('Asosiy menyu:', Markup.keyboard([
        ['📊 Hisobot', '💰 Qolgan mablag‘'],
        ['📋 Vazifalar', '✅ Topshirilgan']
    ]).resize());
});

bot.hears('📊 Hisobot', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const stats = await StatsService.getWeeklyTaskStats(userId);
    const chartBuffer = await ChartService.generateWeeklyProgressChart(stats);

    ctx.replyWithPhoto({ source: chartBuffer }, { caption: `📊 Haftalik hisobot: ${stats.totalDone} ta task bajarildi.` });
});

bot.hears('💰 Qolgan mablag‘', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const today = new Date();
    const monthStr = format(today, 'yyyy-MM');

    try {
        const summary = await FinanceService.getMonthlySummary(userId, monthStr);
        const remaining = summary.totalIncome - summary.totalSpent;

        let msg = `💰 **Moliya (${monthStr})**:\n\n`;
        msg += `➕ Kirim: ${summary.totalIncome}\n`;
        msg += `➖ Chiqim: ${summary.totalSpent}\n`;
        msg += `💵 **Qolgan**: ${remaining}\n\n`;

        summary.categories.forEach(cat => {
            msg += `- ${cat.name}: ${cat.spent} / ${cat.limit} (${Math.round(cat.percentUsed)}%)\n`;
        });

        ctx.replyWithMarkdown(msg);
    } catch (e) {
        console.error(e);
        ctx.reply('Moliya ma\'lumotlarini olishda xatolik.');
    }
});

bot.hears('📋 Vazifalar', sendTodayTasks);
bot.action('bot:today_tasks', async (ctx) => {
    try {
        await ctx.answerCbQuery();
    } catch {}
    await sendTodayTasks(ctx);
});

bot.hears('✅ Topshirilgan', async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const tasks = await prisma.task.findMany({
        where: {
            userId,
            status: TaskStatus.DONE,
            updatedAt: { gte: startOfToday, lte: endOfToday }
        },
        orderBy: { updatedAt: 'desc' }
    });

    let msg = `✅ **Bugun Bajarilgan**:\n`;
    if (tasks.length === 0) {
        msg += `(Hali hech narsa bajarilmadi)`;
    } else {
        tasks.forEach((t: any) => {
            const time = formatInTashkent(t.updatedAt);
            msg += `✅ ${time} - ${t.title}\n`;
        });
    }

    ctx.replyWithMarkdown(msg);
});

export const registerCommands = () => {
    console.log('Bot commands registered');
};
