import { z } from 'zod';
import { paginacionSchema, textoOpcional } from './common.validator';

export const antibiogramaItemSchema = z.object({
  antibiotico: z.string().trim().min(2, 'Indique el antibiótico').max(80),
  sensibilidad: z.enum(['S', 'I', 'R']),
  haloMm: z.number().min(0).max(99.9).optional(),
});

/**
 * Cuerpo común de carga de hallazgos. Reglas de negocio validadas aquí:
 *  - al menos un hallazgo (Gram, colonias, bacteria u observaciones);
 *  - el antibiograma solo tiene sentido si se aisló una bacteria;
 *  - no se repite un antibiótico (también lo exige el UNIQUE en BD).
 */
const hallazgosBase = z.object({
  hallazgoGram: textoOpcional(5000),
  colonias: textoOpcional(5000),
  bacteriaAislada: textoOpcional(150),
  observaciones: textoOpcional(5000),
  antibiograma: z.array(antibiogramaItemSchema).max(40).default([]),
});

type HallazgosBase = z.infer<typeof hallazgosBase>;

function validarHallazgos(datos: HallazgosBase, ctx: z.RefinementCtx): void {
  const hayHallazgo = Boolean(
    datos.hallazgoGram || datos.colonias || datos.bacteriaAislada || datos.observaciones,
  );
  if (!hayHallazgo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Registre al menos un hallazgo (Gram, colonias, bacteria u observaciones)',
      path: ['hallazgoGram'],
    });
  }

  if (datos.antibiograma.length > 0 && !datos.bacteriaAislada) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El antibiograma requiere indicar la bacteria aislada',
      path: ['bacteriaAislada'],
    });
  }

  const nombres = datos.antibiograma.map((item) => item.antibiotico.toLowerCase());
  if (new Set(nombres).size !== nombres.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Hay antibióticos repetidos en el antibiograma',
      path: ['antibiograma'],
    });
  }
}

export const registrarResultadoSchema = hallazgosBase
  .extend({ muestraExamenId: z.number().int().positive() })
  .superRefine(validarHallazgos);

export const actualizarResultadoSchema = hallazgosBase.superRefine(validarHallazgos);

export const listarResultadosQuerySchema = paginacionSchema.extend({
  estado: z.enum(['PENDIENTE_VALIDACION', 'VALIDADO']).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const worklistQuerySchema = z.object({
  /** "true" → solo los exámenes que aún no tienen resultado cargado. */
  soloPendientes: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});

export type RegistrarResultadoInput = z.infer<typeof registrarResultadoSchema>;
export type ActualizarResultadoInput = z.infer<typeof actualizarResultadoSchema>;
export type ListarResultadosQuery = z.infer<typeof listarResultadosQuerySchema>;
export type WorklistQuery = z.infer<typeof worklistQuerySchema>;
