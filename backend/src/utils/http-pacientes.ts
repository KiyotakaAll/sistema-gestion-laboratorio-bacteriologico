import { asyncHandler } from './http';
import { publicarPacientes } from '../services/identificacion-paciente';

/** Sanitiza las proyecciones de paciente de respuestas clínicas sin alterar sus contratos por ID. */
export const handlerConPacientes = (handler: Parameters<typeof asyncHandler>[0]) =>
  asyncHandler(async (req, res, next) => {
    const json = res.json.bind(res);
    res.json = cuerpo => json(publicarPacientes(cuerpo));
    await handler(req, res, next);
  });
