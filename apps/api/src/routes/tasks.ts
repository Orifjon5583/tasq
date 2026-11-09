import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { TaskService } from '../services/taskService';
import { prisma } from '../app';
import { TaskPriority, TaskStatus, ReminderType } from '@prisma/client';

export const taskRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook('onRequest', app.authenticate);

    // List all tasks
    app.get('/', async (req: any) => {
        return prisma.task.findMany({
            where: { userId: req.user.id },
            include: { reminder: true },
            orderBy: [
                { startAt: 'asc' },
                { createdAt: 'desc' }
            ]
        });
    });

    // Get task by ID
    app.get('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any, reply) => {
        const { id } = req.params;
        const task = await prisma.task.findFirst({
            where: { id, userId: req.user.id },
            include: { reminder: true }
        });
        if (!task) return reply.status(404).send({ error: 'Vazifa topilmadi' });
        return task;
    });

    // Create task
    app.post('/', {
        schema: {
            body: z.object({
                title: z.string().min(1),
                description: z.string().optional(),
                priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
                durationMinutes: z.number().int().default(60),
                startAt: z.string().optional(),
                dueAt: z.string().optional(),
                reminder: z.object({
                    reminderType: z.nativeEnum(ReminderType).default(ReminderType.NONE),
                    intervalMinutes: z.number().int().positive().nullable().optional(),
                    firstReminderAt: z.string().nullable().optional(),
                    stopAtDeadline: z.boolean().default(true),
                    maxReminders: z.number().int().positive().nullable().optional(),
                }).optional()
            })
        }
    }, async (req: any) => {
        const { title, description, priority, durationMinutes, startAt, dueAt, reminder } = req.body;
        return TaskService.create(req.user.id, {
            title, description, priority, durationMinutes, startAt, dueAt, reminder
        });
    });

    // Update task
    app.patch('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any) => {
        const { id } = req.params;
        return TaskService.update(req.user.id, id, req.body);
    });

    app.put('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any) => {
        const { id } = req.params;
        return TaskService.update(req.user.id, id, req.body);
    });

    // Mark as DONE (immediately stops all future notifications)
    app.patch('/:id/done', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any) => {
        const { id } = req.params;
        return TaskService.markDone(req.user.id, id);
    });

    // Reopen completed task
    app.patch('/:id/reopen', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any) => {
        const { id } = req.params;
        return TaskService.reopen(req.user.id, id);
    });

    // Reminder control (pause, resume, snooze, set_interval, set_next_time, disable, enable)
    app.patch('/:id/reminder', {
        schema: {
            params: z.object({ id: z.string() }),
            body: z.object({
                type: z.enum(['pause', 'resume', 'snooze', 'disable', 'enable', 'set_interval', 'set_next_time']),
                minutes: z.number().int().positive().optional(),
                nextTime: z.string().optional()
            })
        }
    }, async (req: any) => {
        const { id } = req.params;
        const { type, minutes, nextTime } = req.body;
        return TaskService.updateReminderControl(req.user.id, id, { type, minutes, nextTime });
    });

    // Delete task
    app.delete('/:id', {
        schema: {
            params: z.object({ id: z.string() })
        }
    }, async (req: any) => {
        const { id } = req.params;
        await prisma.task.delete({
            where: { id, userId: req.user.id }
        });
        return { success: true };
    });

    // Auto plan
    app.post('/plan', {
        schema: {
            body: z.object({ date: z.string().optional() })
        }
    }, async (req: any) => {
        const body = req.body;
        const date = body.date ? new Date(body.date) : new Date();
        return TaskService.autoPlan(req.user.id, date);
    });

    // Gaps
    app.get('/gaps', async (req: any) => {
        return TaskService.getWorkGaps(req.user.id, new Date());
    });
};
