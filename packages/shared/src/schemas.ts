import { z } from 'zod';

export const UserRole = z.enum(['ADMIN', 'USER']);

export const ReminderTypeEnum = z.enum(['NONE', 'ONCE', 'REPEATED', 'CUSTOM']);
export type ReminderType = z.infer<typeof ReminderTypeEnum>;

export const TaskPriorityEnum = z.enum(['IMPORTANT', 'NORMAL', 'FUTURE']);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const TaskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const ReminderSettingsSchema = z.object({
    id: z.string().optional(),
    taskId: z.string().optional(),
    reminderType: ReminderTypeEnum.default('NONE'),
    intervalMinutes: z.number().int().positive().nullable().optional(),
    firstReminderAt: z.string().datetime().nullable().optional(),
    nextReminderAt: z.string().datetime().nullable().optional(),
    lastReminderAt: z.string().datetime().nullable().optional(),
    isEnabled: z.boolean().default(true),
    isPaused: z.boolean().default(false),
    stopAtDeadline: z.boolean().default(true),
    maxReminders: z.number().int().positive().nullable().optional(),
    sentCount: z.number().int().default(0),
    snoozedUntil: z.string().datetime().nullable().optional(),
});
export type ReminderSettings = z.infer<typeof ReminderSettingsSchema>;

export const CreateTaskSchema = z.object({
    title: z.string().min(1, 'Vazifa sarlavhasi kiritilishi shart'),
    description: z.string().optional(),
    priority: TaskPriorityEnum.default('NORMAL'),
    durationMinutes: z.number().int().default(60),
    startAt: z.string().optional(), // ISO string or datetime
    dueAt: z.string().optional(),   // ISO string or datetime
    reminder: z.object({
        reminderType: ReminderTypeEnum.default('NONE'),
        intervalMinutes: z.number().int().positive().nullable().optional(),
        firstReminderAt: z.string().nullable().optional(),
        stopAtDeadline: z.boolean().default(true),
        maxReminders: z.number().int().positive().nullable().optional(),
    }).optional()
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
