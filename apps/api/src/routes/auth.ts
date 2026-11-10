import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../app';
import { bot } from '../bot/instance';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
    app.post('/register', {
        schema: {
            body: z.object({
                name: z.string(),
                email: z.string().email(),
                password: z.string().min(6),
            }),
        },
    }, async (request, reply) => {
        const { name, email, password } = request.body as any;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return reply.status(400).send({ message: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, passwordHash },
        });

        const token = app.jwt.sign({ id: user.id, email: user.email });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                telegramChatId: user.telegramChatId,
                allowReminders: user.allowReminders,
                lessonMode: user.lessonMode
            }
        };
    });

    app.post('/login', {
        schema: {
            body: z.object({
                email: z.string().email(),
                password: z.string(),
            }),
        },
    }, async (request, reply) => {
        const { email, password } = request.body as any;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return reply.status(401).send({ message: 'Invalid credentials' });
        }

        const token = app.jwt.sign({ id: user.id, email: user.email });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                telegramChatId: user.telegramChatId,
                allowReminders: user.allowReminders,
                lessonMode: user.lessonMode
            }
        };
    });

    // Authenticated profile info
    app.get('/profile', {
        onRequest: [app.authenticate]
    }, async (request: any, reply) => {
        const user = await prisma.user.findUnique({
            where: { id: request.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                telegramChatId: true,
                telegramLinkCode: true,
                allowReminders: true,
                lessonMode: true,
                timezone: true
            }
        });
        if (!user) return reply.status(404).send({ message: 'User not found' });
        return user;
    });

    // Update profile settings (Telegram Chat ID, allowReminders, lessonMode)
    app.patch('/profile', {
        onRequest: [app.authenticate],
        schema: {
            body: z.object({
                name: z.string().optional(),
                telegramChatId: z.string().nullable().optional(),
                allowReminders: z.boolean().optional(),
                lessonMode: z.boolean().optional(),
            })
        }
    }, async (request: any) => {
        const { name, telegramChatId, allowReminders, lessonMode } = request.body;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (telegramChatId !== undefined) {
            const cleanId = telegramChatId ? telegramChatId.trim() : null;
            if (cleanId) {
                // Detach from any other user to prevent unique constraint error
                await prisma.user.updateMany({
                    where: { telegramChatId: cleanId, id: { not: request.user.id } },
                    data: { telegramChatId: null }
                });
            }
            data.telegramChatId = cleanId;
        }
        if (allowReminders !== undefined) data.allowReminders = allowReminders;
        if (lessonMode !== undefined) data.lessonMode = lessonMode;

        const updated = await prisma.user.update({
            where: { id: request.user.id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                telegramChatId: true,
                telegramLinkCode: true,
                allowReminders: true,
                lessonMode: true,
                timezone: true
            }
        });

        return updated;
    });

    // Generate link code for Telegram
    app.post('/telegram/link-code', {
        onRequest: [app.authenticate]
    }, async (request: any) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await prisma.user.update({
            where: { id: request.user.id },
            data: { telegramLinkCode: code }
        });

        let botInfo: any = null;
        try {
            botInfo = await bot.telegram.getMe();
        } catch {
            botInfo = { username: 'RejaBotUzBOT' };
        }

        const username = botInfo?.username || 'RejaBotUzBOT';
        const deepLink = `https://t.me/${username}?start=${code}`;

        return {
            linkCode: code,
            botUsername: username,
            deepLink
        };
    });

    app.get('/me', {
        onRequest: [app.authenticate]
    }, async (request: any) => {
        return prisma.user.findUnique({
            where: { id: request.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                telegramChatId: true,
                allowReminders: true,
                lessonMode: true
            }
        });
    });
};
