import { Router } from 'express';
import * as resultadoController from '../controllers/resultado.controller';
import { authenticate } from '../middlewares/auth';
import { requireRoles } from '../middlewares/roleCheck';

const router = Router();

router.use(authenticate);

// Lectura: roles que trabajan con resultados (recepción no accede a hallazgos clínicos).
const lectura = requireRoles('BACTERIOLOGO', 'VALIDADOR', 'ADMINISTRADOR');

// '/worklist' va antes de '/:id' para que no se interprete "worklist" como un id.
router.get('/worklist', requireRoles('BACTERIOLOGO', 'ADMINISTRADOR'), resultadoController.worklist);
router.get('/', lectura, resultadoController.listar);
router.get('/:id', lectura, resultadoController.obtener);

// Carga y corrección: solo bacteriólogos.
router.post('/', requireRoles('BACTERIOLOGO'), resultadoController.registrar);
router.put('/:id', requireRoles('BACTERIOLOGO'), resultadoController.actualizar);

// Validación formal (doble firma): solo VALIDADOR, sin bypass de administrador.
router.patch('/:id/validar', requireRoles('VALIDADOR'), resultadoController.validar);

export default router;
