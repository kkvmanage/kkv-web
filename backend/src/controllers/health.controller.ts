import { Request, Response } from 'express';
import { telegramClient } from '../telegram/telegram.client.js';

export const getHealth = async (_req: Request, res: Response) => {
  const telegramHealth = await telegramClient.checkHealth();
  const isHealthy = telegramHealth.connected;

  const responsePayload = {
    success: isHealthy,
    status: isHealthy ? 'ok' : 'degraded',
    backend: 'running',
    storage: 'telegram',
    telegram: isHealthy ? 'connected' : 'disconnected',
    ready: isHealthy,
    botUsername: telegramHealth.botUsername,
    chatTitle: telegramHealth.chatTitle,
    timestamp: new Date().toISOString(),
    ...(telegramHealth.error ? { error: telegramHealth.error } : {})
  };

  return res.status(isHealthy ? 200 : 503).json(responsePayload);
};

export default getHealth;
