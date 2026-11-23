import { Router, type Response } from 'express';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import { documentoSolicitud, remisionVacia } from '../services/documento.service';

const router = Router();
function enviar(res: Response, documento: { pdf: Buffer; nombre: string }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${documento.nombre.replace(/[^a-zA-Z0-9_.-]/g, '_')}"`);
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.send(documento.pdf);
}
router.get('/solicitudes/:id/informe.pdf', authenticate, requirePermiso('informes.descargar'), asyncHandler(async (req,res) => {
  enviar(res, await documentoSolicitud(idParamSchema.parse(req.params).id, 'informe', auditContext(req)));
}));
router.get('/solicitudes/:id/orden.pdf', authenticate, requirePermiso('solicitudes.leer'), asyncHandler(async (req,res) => {
  enviar(res, await documentoSolicitud(idParamSchema.parse(req.params).id, 'orden', auditContext(req)));
}));
router.get('/documentos/remision-vacia.pdf', authenticate, requirePermiso('solicitudes.leer'), asyncHandler(async (req,res) => {
  enviar(res, await remisionVacia(auditContext(req)));
}));
export default router;
