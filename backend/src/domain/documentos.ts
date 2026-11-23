import { AppError } from '../types/errors';
import { hallazgosResultadoSchema } from '../validators/resultado.validator';

export interface ProfesionalDocumento { id: number; nombreCompleto: string; rol: { nombre: string } }
export interface ResultadoDocumento {
  id: number; estado: string; usuarioIdRegistra: number; usuarioIdValida: number | null;
  fechaRegistro: Date; fechaValidacion: Date | null;
  hallazgoGram: string | null; colonias: string | null; bacteriaAislada: string | null; observaciones: string | null;
  registradoPor: ProfesionalDocumento; validadoPor: ProfesionalDocumento | null;
  antibiograma: { antibiotico: string; sensibilidad: 'S' | 'I' | 'R'; haloMm: unknown }[];
}
export interface ExamenDocumento { id: number; codigo: string; nombre: string }
export interface MuestraDocumento {
  id: number; codigoBarras: string; estado: string; tipoMuestra: string; sitioAnatomico: string | null;
  fechaToma: Date; fechaRecepcion: Date | null;
  examenes: { examen: ExamenDocumento; resultado: ResultadoDocumento | null }[];
}
export interface LineaOrdenDocumento {
  examenId: number; tipoMuestra: string; sitioAnatomico: string | null;
  instruccionesToma: string | null; examen: ExamenDocumento;
}
export interface SolicitudDocumento {
  id: number; codigo: string; fechaSolicitud: Date; prioridad: string;
  medicoSolicitante: string | null; medicoRemitenteNombre?: string | null;
  diagnosticoPresuntivo: string | null; observaciones: string | null;
  paciente: { id: number; cedula: string | null; nombres: string; apellidos: string; fechaNacimiento: Date;
    estadoIdentificacion?: string; tipoDocumento?: string | null; numeroDocumento?: string | null; paisEmisorDocumento?: string | null };
  muestras: MuestraDocumento[];
  examenesSolicitados?: LineaOrdenDocumento[];
}

/** No hay informe parcial presentado como final: todos los exámenes activos deben estar validados. */
export function exigirInformeFinal(solicitud: SolicitudDocumento): MuestraDocumento[] {
  const muestras = solicitud.muestras.filter(m => m.estado !== 'RECHAZADA');
  if (!muestras.length || muestras.some(m => m.estado !== 'PROCESADA' || !m.fechaRecepcion || !m.examenes.length))
    throw new AppError(409, 'La solicitud tiene muestras sin completar o no tiene resultados emitibles.', 'INFORME_NO_VALIDADO');
  for (const muestra of muestras) for (const { resultado: r } of muestra.examenes) {
    if (!r || r.estado !== 'VALIDADO' || !r.usuarioIdValida || !r.fechaValidacion
      || !r.validadoPor?.nombreCompleto || !r.registradoPor?.nombreCompleto
      || !['BACTERIOLOGO', 'VALIDADOR'].includes(r.validadoPor.rol.nombre)
      || r.usuarioIdValida === r.usuarioIdRegistra
      || r.validadoPor.id !== r.usuarioIdValida || r.registradoPor.id !== r.usuarioIdRegistra
      || !hallazgosResultadoSchema.safeParse({ hallazgoGram: r.hallazgoGram ?? undefined,
        colonias: r.colonias ?? undefined, bacteriaAislada: r.bacteriaAislada ?? undefined,
        observaciones: r.observaciones ?? undefined,
        antibiograma: r.antibiograma.map(a => ({ ...a, haloMm: a.haloMm == null ? undefined : Number(a.haloMm) })),
      }).success)
      throw new AppError(409, 'Todos los resultados deben estar completos y validados con doble firma.', 'INFORME_NO_VALIDADO');
  }
  for (const linea of solicitud.examenesSolicitados ?? []) {
    if (!muestras.some(m => m.tipoMuestra === linea.tipoMuestra && m.sitioAnatomico === linea.sitioAnatomico
      && m.examenes.some(e => e.examen.id === linea.examenId)))
      throw new AppError(409, 'Faltan exámenes de la orden por completar y validar.', 'INFORME_ORDEN_INCOMPLETA');
  }
  return muestras;
}
