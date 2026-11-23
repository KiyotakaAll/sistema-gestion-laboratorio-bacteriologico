import { Router } from 'express';
import * as resultadoController from '../controllers/resultado.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermiso } from '../middlewares/roleCheck';

const router = Router();

router.use(authenticate);

// Lectura: roles que trabajan con resultados (recepción no accede a hallazgos clínicos).
const lectura = requirePermiso('resultados.leer');

// '/worklist' va antes de '/:id' para que no se interprete "worklist" como un id.
router.get('/worklist', requirePermiso('resultados.worklist'), resultadoController.worklist);
router.get('/', lectura, resultadoController.listar);
router.get('/:id', lectura, resultadoController.obtener);

// Carga y corrección: solo bacteriólogos.
router.post('/', requirePermiso('resultados.escribir'), resultadoController.registrar);
router.put('/:id', requirePermiso('resultados.escribir'), resultadoController.actualizar);

// Validación según política vigente; conserva doble firma y nunca hay bypass administrativo.
router.patch('/:id/validar', requirePermiso('resultados.validar'), resultadoController.validar);

export default router;
