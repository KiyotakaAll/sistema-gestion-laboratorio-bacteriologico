import * as resultadoService from '../services/resultado.service';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import {
  actualizarResultadoSchema,
  listarResultadosQuerySchema,
  registrarResultadoSchema,
  worklistQuerySchema,
} from '../validators/resultado.validator';

export const worklist = asyncHandler(async (req, res) => {
  const query = worklistQuerySchema.parse(req.query);
  res.json({ data: await resultadoService.obtenerWorklist(query) });
});

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarResultadosQuerySchema.parse(req.query);
  res.json(await resultadoService.listarResultados(filtros));
});

export const obtener = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await resultadoService.obtenerResultadoPorId(id) });
});

export const registrar = asyncHandler(async (req, res) => {
  const input = registrarResultadoSchema.parse(req.body);
  const resultado = await resultadoService.registrarResultado(input, auditContext(req));
  res.status(201).json({ data: resultado });
});

export const actualizar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = actualizarResultadoSchema.parse(req.body);
  res.json({ data: await resultadoService.actualizarResultado(id, input, auditContext(req)) });
});

export const validar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await resultadoService.validarResultado(id, auditContext(req)) });
});
