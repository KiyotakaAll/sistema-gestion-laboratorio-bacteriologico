import * as servicio from '../services/medico.service';
import { directorioMedicosDisponible } from '../services/medicos-disponibilidad';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import { datosMedicoSchema, estadoMedicoSchema, listarMedicosSchema } from '../validators/medico.validator';

export const capacidades = asyncHandler(async (_req, res) => {
  res.json({ data: { directorioMedicos: await directorioMedicosDisponible() } });
});
export const listar = asyncHandler(async (req, res) => { res.json(await servicio.listarMedicos(listarMedicosSchema.parse(req.query))); });
export const obtener = asyncHandler(async (req, res) => {
  res.json({ data: await servicio.obtenerMedico(idParamSchema.parse(req.params).id) });
});
export const crear = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await servicio.guardarMedico(null, datosMedicoSchema.parse(req.body), auditContext(req)) });
});
export const actualizar = asyncHandler(async (req, res) => {
  res.json({ data: await servicio.guardarMedico(idParamSchema.parse(req.params).id, datosMedicoSchema.parse(req.body), auditContext(req)) });
});
export const estado = asyncHandler(async (req, res) => {
  res.json({ data: await servicio.cambiarEstadoMedico(idParamSchema.parse(req.params).id, estadoMedicoSchema.parse(req.body).activo, auditContext(req)) });
});
