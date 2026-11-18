import * as usuarioService from '../services/usuario.service';
import { asyncHandler, auditContext } from '../utils/http';
import { activarUsuarioSchema, listarUsuariosSchema, usuarioIdSchema } from '../validators/usuario.validator';

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarUsuariosSchema.parse(req.query);
  res.json(await usuarioService.listarUsuarios(filtros, auditContext(req).usuarioId));
});

export const activar = asyncHandler(async (req, res) => {
  const { id } = usuarioIdSchema.parse(req.params);
  activarUsuarioSchema.parse(req.body ?? {});
  res.json({ data: await usuarioService.activarUsuario(id, auditContext(req)) });
});
