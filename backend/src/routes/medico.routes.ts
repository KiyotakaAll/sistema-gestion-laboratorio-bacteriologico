import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';
import * as c from '../controllers/medico.controller';

const router = Router();
router.use(authenticate);
router.get('/capacidades', requirePermiso('medicos.leer'), c.capacidades);
// Mismos lectores clínicos autenticados; escrituras con los roles existentes de admisión.
router.get('/', requirePermiso('medicos.leer'), c.listar);
router.get('/:id', requirePermiso('medicos.leer'), c.obtener);
router.post('/', requirePermiso('medicos.escribir'), c.crear);
router.put('/:id', requirePermiso('medicos.escribir'), c.actualizar);
router.patch('/:id/estado', requirePermiso('medicos.escribir'), c.estado);
export default router;
