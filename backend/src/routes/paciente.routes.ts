import { Router } from 'express';
import * as pacienteController from '../controllers/paciente.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';

const router = Router();

router.use(authenticate);

// Lectura: cualquier rol autenticado (el bacteriólogo necesita ver datos del paciente).
router.get('/', requirePermiso('pacientes.leer'), pacienteController.listar);
router.get('/capacidades', requirePermiso('pacientes.leer'), pacienteController.capacidades);
router.get('/:id', requirePermiso('pacientes.leer'), pacienteController.obtener);

// Admisión: solo recepción (y administración).
router.post('/', requirePermiso('pacientes.escribir'), pacienteController.crear);
router.put('/:id', requirePermiso('pacientes.escribir'), pacienteController.actualizar);
router.patch('/:id/identificacion', requirePermiso('pacientes.escribir'), pacienteController.actualizarIdentificacion);

export default router;
