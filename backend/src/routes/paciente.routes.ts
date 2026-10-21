import { Router } from 'express';
import * as pacienteController from '../controllers/paciente.controller';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';

const router = Router();

router.use(authenticate);

// Lectura: cualquier rol autenticado (el bacteriólogo necesita ver datos del paciente).
router.get('/', pacienteController.listar);
router.get('/:id', pacienteController.obtener);

// Admisión: solo recepción (y administración).
router.post('/', requireRoles('RECEPCIONISTA', 'ADMINISTRADOR'), pacienteController.crear);
router.put('/:id', requireRoles('RECEPCIONISTA', 'ADMINISTRADOR'), pacienteController.actualizar);

export default router;
