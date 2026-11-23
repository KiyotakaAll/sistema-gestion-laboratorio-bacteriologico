import * as ordenService from '../services/orden.service';
import { auditContext } from '../utils/http';
import { handlerConPacientes as asyncHandler } from '../utils/http-pacientes';
import { idParamSchema } from '../validators/common.validator';
import { crearSolicitudSchema, listarSolicitudesQuerySchema } from '../validators/orden.validator';
import { remitenteSolicitudSchema } from '../validators/medico.validator';

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarSolicitudesQuerySchema.parse(req.query);
  res.json(await ordenService.listarSolicitudes(filtros));
});

export const obtener = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await ordenService.obtenerSolicitudPorId(id) });
});

export const crear = asyncHandler(async (req, res) => {
  const input = crearSolicitudSchema.parse(req.body);
  res.status(201).json({ data: await ordenService.crearSolicitud(input, auditContext(req)) });
});

export const examenes = asyncHandler(async (_req, res) => {
  res.json({ data: await ordenService.listarExamenes() });
});

export const actualizarRemitente = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { medicoRemitenteId } = remitenteSolicitudSchema.parse(req.body);
  res.json({ data: await ordenService.actualizarRemitente(id, medicoRemitenteId, auditContext(req)) });
});
