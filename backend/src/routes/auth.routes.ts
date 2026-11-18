import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { limitarRegistro } from '../middlewares/limitarRegistro';

const router = Router();

// Rutas públicas; el registro no crea una sesión.
router.post('/login', authController.login);
router.post('/register', limitarRegistro, authController.registro);
router.get('/me', authenticate, authController.perfil);

export default router;
