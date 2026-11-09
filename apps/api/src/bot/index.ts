import { Telegraf, Context, Markup } from 'telegraf';
import { prisma } from '../app';
import { StatsService } from '../services/statsService';
import { bot } from './instance';

export { bot };

const buildMainMenuKeyboard = () => {
    return Markup.keyboard([
        ['📋 Vazifalar', '🎓 Dars Rejimi'],
        ['🔔 Eslatma Ruxsati', '📊 Hisobot'],
        ['💰 Qolgan mablag‘', '✅ Topshirilgan']
    ]).resize();
};

// /start command
bot.start(async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const payload = (ctx as any).startPayload;

    let user = null;

    // 1. If startPayload exists (e.g. https://t.me/bot?start=CODE)
    if (payload) {
        user = await prisma.user.findUnique({ where: { telegramLinkCode: payload } });
        if (user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { telegramChatId: chatId, telegramLinkCode: null }
            });
        }
    }

    // 2. If not found by payload, check if already linked by telegramChatId
    if (!user) {
        user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    }

    // 3. Fallback: if only one demo user exists and no chat ID linked yet
    if (!user) {
        const singleUser = await prisma.user.findFirst();
        if (singleUser && !singleUser.telegramChatId) {
            user = await prisma.user.update({
                where: { id: singleUser.id },
                data: { telegramChatId: chatId }
            });
        }
    }

    const allowReminders = user?.allowReminders ?? true;
    const lessonMode = user?.lessonMode ?? false;

    const message =
        `👋 **Assalomu alaykum, ${user ? user.name : 'Foydalanuvchi'}!**\n\n` +
        `🆔 **Sizning Telegram Chat ID:** \`${chatId}\`\n\n` +
        (user
            ? `✅ **Hisob holati**: Sayt hisobingizga muvaffaqiyatli bog‘landi!\n\n`
            : `⚠️ **Hisob holati**: Sayt bilan bog‘lanmagan. Ushbu Chat ID ni saytdagi profilingizga kiriting yoki saytdan "Botni Ulash" tugmasini bosing.\n\n`) +
        `⚙️ **Sozlamalar holati:**\n` +
        `🔔 **Eslatma yuborish:** ${allowReminders ? '🟢 FAOL (Eslatmalar yuboriladi)' : '🔴 O‘CHIRILGAN (Eslatma yuborilmaydi)'}\n` +
        `🎓 **Dars rejimi:** ${lessonMode ? '🟢 FAOL (Dars paytida bezovta qilinmaydi)' : '⚪ NOFAOL (Oddiy rejim)'}\n\n` +
        `_Quyidagi tugmalar orqali eslatma va dars rejimini boshqarishingiz mumkin:_`;

    const inlineKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(
                lessonMode ? '🎓 Dars rejimini O‘chirish' : '🎓 Dars rejimini Yoqish',
                'bot:toggle_lesson'
            )
        ],
        [
            Markup.button.callback(
                allowReminders ? '🔕 Eslatmalarni O‘chirish' : '🔔 Eslatmalarni Yoqish',
                'bot:toggle_reminders'
            )
        ],
        [
            Markup.button.callback('📋 Bugungi Vazifalar', 'bot:today_tasks')
        ]
    ]);

    await ctx.replyWithMarkdown(message, buildMainMenuKeyboard());
    await ctx.reply('⚙️ Tezkor sozlamalar:', inlineKeyboard);
});

// Toggle Lesson Mode (Dars rejimi) via inline button
bot.action('bot:toggle_lesson', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    let user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.answerCbQuery('Hisobingiz bog‘lanmagan.');

    const newMode = !user.lessonMode;
    await prisma.user.update({
        where: { id: user.id },
        data: { lessonMode: newMode }
    });

    await ctx.answerCbQuery(newMode ? '🎓 Dars rejimi yoqildi!' : '🎓 Dars rejimi o‘chirildi!');

    const msg = newMode
        ? `🎓 **Dars rejimi faollashtirildi!**\n\nDars davomida chalg‘itmaslik uchun vazifalar eslatmalari to‘xtatib turiladi.`
        : `🎓 **Dars rejimi o‘chirildi.**\n\nBarcha eslatmalar odatiy reja bo‘yicha yuboriladi.`;

    await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback(
                    newMode ? '🎓 Dars rejimini O‘chirish' : '🎓 Dars rejimini Yoqish',
                    'bot:toggle_lesson'
                )
            ],
            [
                Markup.button.callback(
                    user.allowReminders ? '🔕 Eslatmalarni O‘chirish' : '🔔 Eslatmalarni Yoqish',
                    'bot:toggle_reminders'
                )
            ]
        ])
    });
});

// Toggle Reminders Permission (Eslatma yuborish mumkin yoki yo'q)
bot.action('bot:toggle_reminders', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    let user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.answerCbQuery('Hisobingiz bog‘lanmagan.');

    const newAllow = !user.allowReminders;
    await prisma.user.update({
        where: { id: user.id },
        data: { allowReminders: newAllow }
    });

    await ctx.answerCbQuery(newAllow ? '🔔 Eslatmalar yoqildi!' : '🔕 Eslatmalar o‘chirildi!');

    const msg = newAllow
        ? `🔔 **Eslatma yuborish ruxsati berildi!**\n\nEndi bot sizga rejalashtirilgan vazifalar bo‘yicha eslatmalar yuboradi.`
        : `🔕 **Eslatma yuborish to‘xtatildi!**\n\nBot sizga vazifalar bo‘yicha eslatmalar yubormaydi.`;

    await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback(
                    user.lessonMode ? '🎓 Dars rejimini O‘chirish' : '🎓 Dars rejimini Yoqish',
                    'bot:toggle_lesson'
                )
            ],
            [
                Markup.button.callback(
                    newAllow ? '🔕 Eslatmalarni O‘chirish' : '🔔 Eslatmalarni Yoqish',
                    'bot:toggle_reminders'
                )
            ]
        ])
    });
});

// Reply Keyboard: 🎓 Dars Rejimi
bot.hears('🎓 Dars Rejimi', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan. /start bosing.');

    const newMode = !user.lessonMode;
    await prisma.user.update({
        where: { id: user.id },
        data: { lessonMode: newMode }
    });

    if (newMode) {
        ctx.reply('🎓 **Dars rejimi YOQILDI.** Dars paytida eslatmalar yuborilmaydi (Sokin rejim).', { parse_mode: 'Markdown' });
    } else {
        ctx.reply('🎓 **Dars rejimi O‘CHIRILDI.** Eslatmalar odatiy jadvalda davom etadi.', { parse_mode: 'Markdown' });
    }
});

// Reply Keyboard: 🔔 Eslatma Ruxsati
bot.hears('🔔 Eslatma Ruxsati', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan. /start bosing.');

    const newAllow = !user.allowReminders;
    await prisma.user.update({
        where: { id: user.id },
        data: { allowReminders: newAllow }
    });

    if (newAllow) {
        ctx.reply('🔔 **Eslatma yuborish ruxsati YOQILDI.** Eslatmalar yuboriladi.', { parse_mode: 'Markdown' });
    } else {
        ctx.reply('🔕 **Eslatma yuborish O‘CHIRILDI.** Eslatmalar yuborilmaydi.', { parse_mode: 'Markdown' });
    }
});

// /dars command
bot.command('dars', async (ctx) => {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.reply('⚠️ Hisobingiz bog‘lanmagan.');

    const newMode = !user.lessonMode;
    await prisma.user.update({
        where: { id: user.id },
        data: { lessonMode: newMode }
    });

    ctx.reply(
        newMode
            ? '🎓 **Dars rejimi faollashtirildi.** Dars vaqtida eslatmalar to‘xtatiladi.'
            : '🎓 **Dars rejimi yakunlandi.** Eslatmalar qayta yoqildi.',
        { parse_mode: 'Markdown' }
    );
});

bot.command('stats', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return ctx.reply('Auth required.');

    const stats = await StatsService.getWeeklyTaskStats(user.id);
    ctx.reply(`📊 **Haftalik Statistika**:\n\nJami bajarilgan: ${stats.totalDone}\n\nTo‘liq grafik uchun /chart week ni bosing.`);
});

import './commands'; // Import commands to register them

export const launchBot = () => {
    bot.telegram.setMyCommands([
        { command: 'today', description: 'Bugungi vazifalar' },
        { command: 'dars', description: 'Dars rejimi (Yoqish / O‘chirish)' },
        { command: 'add', description: 'Tezkor vazifa qo‘shish' },
        { command: 'plan', description: 'Kunni avtomatik rejalashtirish' },
        { command: 'stats', description: 'Haftalik statistika' },
        { command: 'start', description: 'Chat ID va hisobni bog‘lash' }
    ]).catch(console.error);

    bot.launch().then(() => console.log('Bot started')).catch(err => console.error('Bot launch error:', err));
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
