import * as usuarioService from '../services/usuario.service';
import { asyncHandler, auditContext } from '../utils/http';
import { activarUsuarioSchema, asignarPerfilUsuarioSchema, crearUsuarioSchema, listarUsuariosSchema, usuarioIdSchema } from '../validators/usuario.validator';

export const capacidades = asyncHandler(async (req, res) => {
  res.json({ data: await usuarioService.capacidadesAltaUsuarios(auditContext(req).usuarioId) });
});

export const crear = asyncHandler(async (req, res) => {
  const input = crearUsuarioSchema.parse(req.body);
  res.status(201).json({ data: await usuarioService.crearUsuario(input, auditContext(req)) });
});

export const listar = asyncHandler(async (req, res) => {
  const filtros = listarUsuariosSchema.parse(req.query);
  res.json(await usuarioService.listarUsuarios(filtros, auditContext(req).usuarioId));
});

export const activar = asyncHandler(async (req, res) => {
  const { id } = usuarioIdSchema.parse(req.params);
  activarUsuarioSchema.parse(req.body ?? {});
  res.json({ data: await usuarioService.activarUsuario(id, auditContext(req)) });
});

export const desactivar = asyncHandler(async (req, res) => {
  const { id } = usuarioIdSchema.parse(req.params);
  activarUsuarioSchema.parse(req.body ?? {});
  res.json({ data: await usuarioService.desactivarUsuario(id, auditContext(req)) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const { id } = usuarioIdSchema.parse(req.params);
  activarUsuarioSchema.parse(req.body ?? {});
  res.json({ data: await usuarioService.eliminarUsuario(id, auditContext(req)) });
});

export const asignarPerfil = asyncHandler(async (req, res) => {
  const { id } = usuarioIdSchema.parse(req.params);
  const { rol } = asignarPerfilUsuarioSchema.parse(req.body);
  res.json({ data: await usuarioService.asignarPerfilUsuario(id, rol, auditContext(req)) });
});
