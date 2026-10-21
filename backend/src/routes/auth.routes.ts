import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Única ruta pública del API (junto con /api/health).
router.post('/login', authController.login);
router.get('/me', authenticate, authController.perfil);

export default router;
