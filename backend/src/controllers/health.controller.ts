import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getFinanceDbName, ensureMongoConnected } from '../config/database.js';
import { googleDriveService } from '../services/googleDrive.service.js';

export const getHealth = async (_req: Request, res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    await ensureMongoConnected();
  }

  const readyState = mongoose.connection.readyState;
  const isMongoConnected = readyState === 1;
  const databaseName = getFinanceDbName();

  const driveHealth = await googleDriveService.checkConnection();

  const isHealthy = isMongoConnected;

  const responsePayload = {
    status: isHealthy ? 'ok' : 'degraded',
    success: isHealthy,
    backend: 'running',
    timestamp: new Date().toISOString(),
    database: {
      status: isMongoConnected ? 'connected' : 'disconnected',
      mongodb: isMongoConnected ? 'connected' : 'disconnected',
      readyState,
      dbName: databaseName
    },
    googleDrive: {
      configured: driveHealth.configured,
      authenticated: driveHealth.authenticated,
      rootFolderAccessible: driveHealth.rootFolderAccessible,
      rootFolderId: driveHealth.rootFolderId,
      rootFolderName: driveHealth.rootFolderName,
      serviceAccountEmail: driveHealth.serviceAccountEmail,
      status: driveHealth.status,
      message: driveHealth.message
    }
  };

  return res.status(isHealthy ? 200 : 503).json(responsePayload);
};

export default getHealth;
