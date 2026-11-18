import { Router } from 'express';
import * as usuarioController from '../controllers/usuario.controller';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';

const router = Router();
router.use(authenticate, requireRoles('ADMINISTRADOR'));
router.get('/', usuarioController.listar);
router.patch('/:id/activar', usuarioController.activar);
export default router;
