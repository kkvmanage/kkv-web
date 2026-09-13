import { Router } from 'express';
import { getTelegramConfig, updateTelegramConfig, testTelegram, backupTelegram } from '../controllers/telegram.controller.js';
import { authenticateUser, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('ADMIN', 'MASTER_ADMIN'));

router.get('/config', getTelegramConfig);
router.put('/config', updateTelegramConfig);
router.post('/test', testTelegram);
router.post('/backup', backupTelegram);

export default router;
