import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';
import { asyncHandler, auditContext } from '../utils/http';
import { catalogoFlujo, crearSitio, crearPlantilla } from '../services/catalogo.service';
import { sitioSchema, plantillaSchema } from '../validators/catalogo.validator';

const router = Router();
router.use(authenticate);
router.get('/flujo', requirePermiso('examenes.leer'), asyncHandler(async (_req, res) => {
  res.json({ data: await catalogoFlujo() });
}));
router.post('/sitios', requirePermiso('usuarios.administrar'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await crearSitio(sitioSchema.parse(req.body), auditContext(req)) });
}));
router.post('/plantillas', requirePermiso('solicitudes.escribir'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await crearPlantilla(plantillaSchema.parse(req.body), auditContext(req)) });
}));
export default router;
