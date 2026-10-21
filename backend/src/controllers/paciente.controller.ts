import * as pacienteService from '../services/paciente.service';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import {
  actualizarPacienteSchema,
  crearPacienteSchema,
  listarPacientesQuerySchema,
} from '../validators/paciente.validator';

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarPacientesQuerySchema.parse(req.query);
  res.json(await pacienteService.listarPacientes(filtros));
});

export const obtener = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await pacienteService.obtenerPacientePorId(id) });
});

export const crear = asyncHandler(async (req, res) => {
  const input = crearPacienteSchema.parse(req.body);
  res.status(201).json({ data: await pacienteService.crearPaciente(input, auditContext(req)) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = actualizarPacienteSchema.parse(req.body);
  res.json({ data: await pacienteService.actualizarPaciente(id, input, auditContext(req)) });
});
