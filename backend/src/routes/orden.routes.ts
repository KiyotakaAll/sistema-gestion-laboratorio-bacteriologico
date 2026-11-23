import { Router } from 'express';
import * as ordenController from '../controllers/orden.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';

/**
 * Este router se monta en la raíz de `/api` (expone /solicitudes y /examenes),
 * por eso `authenticate` se aplica RUTA POR RUTA y no con `router.use(...)`:
 * un `use` global interceptaría cualquier URL desconocida y devolvería 401
 * en lugar del 404 correcto.
 */
const router = Router();

// Catálogo para los formularios de registro de muestras.
router.get('/examenes', authenticate, requirePermiso('examenes.leer'), ordenController.examenes);

router.get('/solicitudes', authenticate, requirePermiso('solicitudes.leer'), ordenController.listar);
router.get('/solicitudes/:id', authenticate, requirePermiso('solicitudes.leer'), ordenController.obtener);
router.post(
  '/solicitudes',
  authenticate,
  requirePermiso('solicitudes.escribir'),
  ordenController.crear,
);
router.patch('/solicitudes/:id/remitente', authenticate,
  requirePermiso('solicitudes.escribir'), ordenController.actualizarRemitente);

export default router;
