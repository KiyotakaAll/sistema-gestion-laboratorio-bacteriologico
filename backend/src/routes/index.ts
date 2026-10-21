import { Router } from 'express';
import authRoutes from './auth.routes';
import muestraRoutes from './muestra.routes';
import ordenRoutes from './orden.routes';
import pacienteRoutes from './paciente.routes';
import resultadoRoutes from './resultado.routes';

/**
 * Router raíz montado en `/api` por app.ts. Cada módulo vive en su propio
 * archivo; aquí solo se componen.
 *
 *   /api/auth        → login y perfil
 *   /api/pacientes   → admisión de pacientes
 *   /api/solicitudes, /api/examenes → solicitudes médicas y catálogo (orden.routes)
 *   /api/muestras    → control de muestras y trazabilidad
 *   /api/resultados  → worklist, carga de hallazgos y doble firma
 */
const router = Router();

router.use('/auth', authRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/', ordenRoutes);
router.use('/muestras', muestraRoutes);
router.use('/resultados', resultadoRoutes);

export default router;
