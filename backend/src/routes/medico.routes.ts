import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';
import * as c from '../controllers/medico.controller';

const router = Router();
router.use(authenticate);
router.get('/capacidades', c.capacidades);
// Mismos lectores clínicos autenticados; escrituras con los roles existentes de admisión.
router.get('/', c.listar);
router.get('/:id', c.obtener);
router.post('/', requireRoles('ADMINISTRADOR', 'RECEPCIONISTA'), c.crear);
router.put('/:id', requireRoles('ADMINISTRADOR', 'RECEPCIONISTA'), c.actualizar);
router.patch('/:id/estado', requireRoles('ADMINISTRADOR', 'RECEPCIONISTA'), c.estado);
export default router;
