import { Router } from 'express';
import * as ordenController from '../controllers/orden.controller';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';

/**
 * Este router se monta en la raíz de `/api` (expone /solicitudes y /examenes),
 * por eso `authenticate` se aplica RUTA POR RUTA y no con `router.use(...)`:
 * un `use` global interceptaría cualquier URL desconocida y devolvería 401
 * en lugar del 404 correcto.
 */
const router = Router();

// Catálogo para los formularios de registro de muestras.
router.get('/examenes', authenticate, ordenController.examenes);

router.get('/solicitudes', authenticate, ordenController.listar);
router.get('/solicitudes/:id', authenticate, ordenController.obtener);
router.post(
  '/solicitudes',
  authenticate,
  requireRoles('RECEPCIONISTA', 'ADMINISTRADOR'),
  ordenController.crear,
);

export default router;
