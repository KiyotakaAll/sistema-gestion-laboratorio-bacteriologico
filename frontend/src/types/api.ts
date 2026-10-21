/**
 * Tipos que reflejan las respuestas del backend. Las fechas llegan como string
 * ISO (JSON no tiene tipo Date) y los DECIMAL de MySQL como string.
 */
export const ROLES = ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'] as const;
export type RolNombre = (typeof ROLES)[number];

export type Sexo = 'M' | 'F' | 'O';
export type Prioridad = 'RUTINA' | 'URGENTE';
export type EstadoMuestra = 'REGISTRADA' | 'RECEPTADA' | 'EN_PROCESAMIENTO' | 'PROCESADA' | 'RECHAZADA';
export type EstadoResultado = 'PENDIENTE_VALIDACION' | 'VALIDADO';
export type Sensibilidad = 'S' | 'I' | 'R';

export interface UsuarioSesion {
  id: number;
  username: string;
  nombreCompleto: string;
  rol: RolNombre;
}

export interface UsuarioResumen {
  id: number;
  username: string;
  nombreCompleto: string;
}

export interface SesionIniciada {
  token: string;
  usuario: UsuarioSesion;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/* ---------- Pacientes y solicitudes ---------- */

export interface Paciente {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: Sexo;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PacienteResumen = Pick<Paciente, 'id' | 'cedula' | 'nombres' | 'apellidos'>;

export interface SolicitudBase {
  id: number;
  codigo: string;
  pacienteId: number;
  usuarioIdRegistra: number;
  medicoSolicitante: string | null;
  diagnosticoPresuntivo: string | null;
  prioridad: Prioridad;
  fechaSolicitud: string;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SolicitudLista extends SolicitudBase {
  paciente: PacienteResumen;
  _count: { muestras: number };
}

export interface PacienteDetalle extends Paciente {
  solicitudes: (SolicitudBase & { _count: { muestras: number } })[];
}

/* ---------- Catálogo ---------- */

export interface Examen {
  id: number;
  codigo: string;
  nombre: string;
  tipoMuestraRequerida: string;
  descripcion: string | null;
  precio: string;
  activo: boolean;
}

export interface ExamenResumen {
  id: number;
  codigo: string;
  nombre: string;
}

/* ---------- Muestras ---------- */

export interface MuestraBase {
  id: number;
  codigoBarras: string;
  solicitudId: number;
  tipoMuestra: string;
  sitioAnatomico: string | null;
  estado: EstadoMuestra;
  fechaToma: string;
  fechaRecepcion: string | null;
  fechaProcesamiento: string | null;
  usuarioIdRecepciona: number | null;
  motivoRechazo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MuestraLista extends MuestraBase {
  solicitud: { id: number; codigo: string; prioridad: Prioridad; paciente: PacienteResumen };
  examenes: { id: number; examen: ExamenResumen }[];
}

export interface AntibiogramaItem {
  id: number;
  resultadoId: number;
  antibiotico: string;
  sensibilidad: Sensibilidad;
  haloMm: string | null;
}

export interface ResultadoBase {
  id: number;
  muestraExamenId: number;
  usuarioIdRegistra: number;
  hallazgoGram: string | null;
  colonias: string | null;
  bacteriaAislada: string | null;
  observaciones: string | null;
  estado: EstadoResultado;
  fechaRegistro: string;
  usuarioIdValida: number | null;
  fechaValidacion: string | null;
  updatedAt: string;
}

export interface ResultadoConAntibiograma extends ResultadoBase {
  antibiograma: AntibiogramaItem[];
}

export interface MuestraExamenBase {
  id: number;
  muestraId: number;
  examenId: number;
  createdAt: string;
}

export interface MuestraDetalle extends MuestraBase {
  solicitud: SolicitudBase & { paciente: Paciente };
  recepcionadoPor: UsuarioResumen | null;
  examenes: (MuestraExamenBase & { examen: Examen; resultado: ResultadoConAntibiograma | null })[];
}

export interface SolicitudDetalle extends SolicitudBase {
  paciente: Paciente;
  registradoPor: UsuarioResumen;
  muestras: (MuestraBase & { examenes: { id: number; examen: ExamenResumen }[] })[];
}

export interface EventoTrazabilidad {
  id: number;
  accion: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  detalle: unknown;
  fechaEvento: string;
  usuario: UsuarioResumen | null;
}

/* ---------- Resultados ---------- */

export interface ResultadoDetalle extends ResultadoConAntibiograma {
  registradoPor: UsuarioResumen;
  validadoPor: UsuarioResumen | null;
  muestraExamen: MuestraExamenBase & {
    examen: Examen;
    muestra: MuestraBase & { solicitud: SolicitudBase & { paciente: Paciente } };
  };
}

export interface WorklistItem extends MuestraExamenBase {
  examen: Examen;
  muestra: MuestraBase & { solicitud: SolicitudBase & { paciente: Paciente } };
  resultado: ResultadoConAntibiograma | null;
}

/* ---------- Cuerpos de petición ---------- */

export interface NuevoPaciente {
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: Sexo;
  telefono?: string;
  email?: string;
  direccion?: string;
}

export type EdicionPaciente = Omit<NuevoPaciente, 'cedula'>;

export interface NuevaSolicitud {
  pacienteId: number;
  prioridad: Prioridad;
  medicoSolicitante?: string;
  diagnosticoPresuntivo?: string;
  observaciones?: string;
}

export interface NuevaMuestra {
  solicitudId: number;
  tipoMuestra: string;
  sitioAnatomico?: string;
  fechaToma: string;
  examenIds: number[];
}

export interface AntibiogramaEntrada {
  antibiotico: string;
  sensibilidad: Sensibilidad;
  haloMm?: number;
}

export interface HallazgosEntrada {
  hallazgoGram?: string;
  colonias?: string;
  bacteriaAislada?: string;
  observaciones?: string;
  antibiograma: AntibiogramaEntrada[];
}

export interface NuevoResultado extends HallazgosEntrada {
  muestraExamenId: number;
}
