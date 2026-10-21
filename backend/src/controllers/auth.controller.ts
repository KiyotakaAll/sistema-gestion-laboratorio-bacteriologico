import * as authService from '../services/auth.service';
import { AppError } from '../types/errors';
import { asyncHandler } from '../utils/http';
import { loginSchema } from '../validators/auth.validator';

export const login = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  res.json({ data: await authService.iniciarSesion(input, req.ip ?? null) });
});

export const perfil = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO');
  }
  res.json({ data: await authService.obtenerPerfil(req.user.id) });
});
