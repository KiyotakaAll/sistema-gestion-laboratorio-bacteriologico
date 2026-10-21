import * as muestraService from '../services/muestra.service';
import { asyncHandler, auditContext } from '../utils/http';
import { idParamSchema } from '../validators/common.validator';
import {
  codigoBarrasParamSchema,
  listarMuestrasQuerySchema,
  rechazarMuestraSchema,
  registrarMuestraSchema,
} from '../validators/muestra.validator';

/**
 * Los controladores solo: (1) validan la entrada con Zod, (2) delegan al
 * servicio, (3) dan forma a la respuesta HTTP. Cero lógica de negocio aquí.
 * Un ZodError lanzado por `parse` llega a errorHandler y responde 400.
 */

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarMuestrasQuerySchema.parse(req.query);
  res.json(await muestraService.listarMuestras(filtros));
});

export const obtener = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await muestraService.obtenerMuestraPorId(id) });
});

export const obtenerPorCodigoBarras = asyncHandler(async (req, res) => {
  const { codigoBarras } = codigoBarrasParamSchema.parse(req.params);
  res.json({ data: await muestraService.obtenerMuestraPorCodigoBarras(codigoBarras) });
});

export const trazabilidad = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await muestraService.obtenerTrazabilidadMuestra(id) });
});

export const registrar = asyncHandler(async (req, res) => {
  const input = registrarMuestraSchema.parse(req.body);
  const muestra = await muestraService.registrarMuestra(input, auditContext(req));
  res.status(201).json({ data: muestra });
});

export const receptar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await muestraService.receptarMuestra(id, auditContext(req)) });
});

export const procesar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json({ data: await muestraService.iniciarProcesamiento(id, auditContext(req)) });
});

export const rechazar = asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { motivoRechazo } = rechazarMuestraSchema.parse(req.body);
  res.json({ data: await muestraService.rechazarMuestra(id, motivoRechazo, auditContext(req)) });
});
