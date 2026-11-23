import * as pacienteService from '../services/paciente.service';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import {
  actualizarPacienteSchema,
  actualizarIdentificacionSchema,
  crearPacienteSchema,
  crearPacienteIdentificadoSchema,
  listarPacientesQuerySchema,
} from '../validators/paciente.validator';
import { capacidadesIdentificacion, identificacionActiva, publicarPacientes } from '../services/identificacion-paciente';
import { AppError } from '../types/errors';

export const capacidades = asyncHandler(async (_req, res) => { res.json({ data: await capacidadesIdentificacion() }); });

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarPacientesQuerySchema.parse(req.query);
  res.json(publicarPacientes(await pacienteService.listarPacientes(filtros)));
});

export const obtener = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: publicarPacientes(await pacienteService.obtenerPacientePorId(id)) });
});

export const crear = asyncHandler(async (req, res) => {
  if (!identificacionActiva() && req.body && typeof req.body === 'object' && 'identificacion' in req.body) {
    throw new AppError(503, 'La identificación ampliada todavía no está habilitada.', 'IDENTIFICACION_DESHABILITADA');
  }
  const input = identificacionActiva() ? crearPacienteIdentificadoSchema.parse(req.body) : crearPacienteSchema.parse(req.body);
  res.status(201).json({ data: publicarPacientes(await pacienteService.crearPaciente(input, auditContext(req))) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = actualizarPacienteSchema.parse(req.body);
  res.json({ data: publicarPacientes(await pacienteService.actualizarPaciente(id, input, auditContext(req))) });
});

export const actualizarIdentificacion = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = actualizarIdentificacionSchema.parse(req.body);
  res.json({ data: publicarPacientes(await pacienteService.actualizarIdentificacion(id, input, auditContext(req))) });
});
