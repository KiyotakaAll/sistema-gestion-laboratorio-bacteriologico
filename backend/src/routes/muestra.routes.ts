import { Router } from 'express';
import * as muestraController from '../controllers/muestra.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';

const router = Router();

// Todo el módulo exige sesión válida.
router.use(authenticate);

// Lectura: cualquier rol autenticado.
router.get('/', requirePermiso('muestras.leer'), muestraController.listar);
// IMPORTANTE: '/codigo/:codigoBarras' va antes de '/:id' para que no lo capture como id.
router.get('/codigo/:codigoBarras', requirePermiso('muestras.leer'), muestraController.obtenerPorCodigoBarras);
router.get('/:id', requirePermiso('muestras.leer'), muestraController.obtener);
router.get('/:id/trazabilidad', requirePermiso('muestras.leer'), muestraController.trazabilidad);

// Escritura: según la responsabilidad de cada rol en el flujo del laboratorio.
router.post('/', requirePermiso('muestras.registrar'), muestraController.registrar);
router.patch('/:id/receptar', requirePermiso('muestras.receptar'), muestraController.receptar);
router.patch('/:id/procesar', requirePermiso('muestras.procesar'), muestraController.procesar);
router.patch(
  '/:id/rechazar',
  requirePermiso('muestras.rechazar'),
  muestraController.rechazar,
);

export default router;
