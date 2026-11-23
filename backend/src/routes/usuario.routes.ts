import { Router } from 'express';
import * as usuarioController from '../controllers/usuario.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';

const router = Router();
router.use(authenticate, requirePermiso('usuarios.administrar'));
router.get('/', usuarioController.listar);
router.get('/capacidades', usuarioController.capacidades);
router.post('/', usuarioController.crear);
router.patch('/:id/activar', usuarioController.activar);
export default router;
