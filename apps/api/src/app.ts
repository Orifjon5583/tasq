import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string(),
    JWT_ACCESS_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    TELEGRAM_BOT_TOKEN: z.string(),
    FRONTEND_URL: z.string().optional(),
});

const env = envSchema.parse(process.env);

export const prisma = new PrismaClient();

const app = Fastify({
    logger: true,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(cors, {
    origin: true,
});

app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
});

app.decorate('authenticate', async (request: any, reply: any) => {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.send(err);
    }
});

app.register(authRoutes, { prefix: '/api/auth' });
app.register(taskRoutes, { prefix: '/api/tasks' });
app.register(financeRoutes, { prefix: '/api/finance' });
app.register(analyticsRoutes, { prefix: '/api/analytics' });
app.register(savedLinkRoutes, { prefix: '/api/links' });
app.register(eventRoutes, { prefix: '/api/events' });

app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date() };
});

// Init Bot and Scheduler
import { launchBot } from './bot';
import { SchedulerService } from './services/schedulerService';
import { authRoutes } from './routes/auth';
import { taskRoutes } from './routes/tasks';
import { financeRoutes } from './routes/finance';
import { analyticsRoutes } from './routes/analytics';
import { savedLinkRoutes } from './routes/savedLinks';
import { eventRoutes } from './routes/events';

const start = async () => {
    try {
        SchedulerService.init();
        launchBot(); // Start bot
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        console.log(`Server running on port ${env.PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
