import { Router } from 'express';
import * as muestraController from '../controllers/muestra.controller';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';

const router = Router();

// Todo el módulo exige sesión válida.
router.use(authenticate);

// Lectura: cualquier rol autenticado.
router.get('/', muestraController.listar);
// IMPORTANTE: '/codigo/:codigoBarras' va antes de '/:id' para que no lo capture como id.
router.get('/codigo/:codigoBarras', muestraController.obtenerPorCodigoBarras);
router.get('/:id', muestraController.obtener);
router.get('/:id/trazabilidad', muestraController.trazabilidad);

// Escritura: según la responsabilidad de cada rol en el flujo del laboratorio.
router.post('/', requireRoles('RECEPCIONISTA', 'ADMINISTRADOR'), muestraController.registrar);
router.patch('/:id/receptar', requireRoles('RECEPCIONISTA', 'ADMINISTRADOR'), muestraController.receptar);
router.patch('/:id/procesar', requireRoles('BACTERIOLOGO'), muestraController.procesar);
router.patch(
  '/:id/rechazar',
  requireRoles('RECEPCIONISTA', 'BACTERIOLOGO', 'ADMINISTRADOR'),
  muestraController.rechazar,
);

export default router;
