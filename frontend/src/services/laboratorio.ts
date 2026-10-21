import type { AxiosResponse } from 'axios';
import type {
  EdicionPaciente,
  EstadoMuestra,
  EstadoResultado,
  EventoTrazabilidad,
  Examen,
  HallazgosEntrada,
  MuestraDetalle,
  MuestraLista,
  NuevaMuestra,
  NuevaSolicitud,
  NuevoPaciente,
  NuevoResultado,
  Paciente,
  PacienteDetalle,
  Paginado,
  Prioridad,
  ResultadoDetalle,
  SesionIniciada,
  SolicitudDetalle,
  SolicitudLista,
  UsuarioSesion,
  WorklistItem,
} from '../types/api';
import { api } from './api';

/** Las respuestas simples del API vienen envueltas como { data }. */
const datos = <T>(respuesta: AxiosResponse<{ data: T }>): T => respuesta.data.data;
const pagina = <T>(respuesta: AxiosResponse<Paginado<T>>): Paginado<T> => respuesta.data;

interface Paginacion {
  page?: number;
  pageSize?: number;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ data: SesionIniciada }>('/auth/login', { username, password }).then(datos),
  perfil: () => api.get<{ data: UsuarioSesion }>('/auth/me').then(datos),
};

export const pacientesApi = {
  listar: (params: Paginacion & { q?: string }) =>
    api.get<Paginado<Paciente>>('/pacientes', { params }).then(pagina),
  obtener: (id: number) => api.get<{ data: PacienteDetalle }>(`/pacientes/${id}`).then(datos),
  crear: (cuerpo: NuevoPaciente) => api.post<{ data: Paciente }>('/pacientes', cuerpo).then(datos),
  actualizar: (id: number, cuerpo: EdicionPaciente) =>
    api.put<{ data: Paciente }>(`/pacientes/${id}`, cuerpo).then(datos),
};

export const solicitudesApi = {
  listar: (params: Paginacion & { pacienteId?: number; cedula?: string; prioridad?: Prioridad }) =>
    api.get<Paginado<SolicitudLista>>('/solicitudes', { params }).then(pagina),
  obtener: (id: number) => api.get<{ data: SolicitudDetalle }>(`/solicitudes/${id}`).then(datos),
  crear: (cuerpo: NuevaSolicitud) =>
    api.post<{ data: SolicitudDetalle }>('/solicitudes', cuerpo).then(datos),
};

export const examenesApi = {
  listar: () => api.get<{ data: Examen[] }>('/examenes').then(datos),
};

export interface FiltrosMuestras extends Paginacion {
  estado?: EstadoMuestra;
  codigoBarras?: string;
  cedula?: string;
  desde?: string;
  hasta?: string;
}

export const muestrasApi = {
  listar: (params: FiltrosMuestras) =>
    api.get<Paginado<MuestraLista>>('/muestras', { params }).then(pagina),
  obtener: (id: number) => api.get<{ data: MuestraDetalle }>(`/muestras/${id}`).then(datos),
  porCodigo: (codigo: string) =>
    api.get<{ data: MuestraDetalle }>(`/muestras/codigo/${encodeURIComponent(codigo)}`).then(datos),
  trazabilidad: (id: number) =>
    api.get<{ data: EventoTrazabilidad[] }>(`/muestras/${id}/trazabilidad`).then(datos),
  registrar: (cuerpo: NuevaMuestra) =>
    api.post<{ data: MuestraDetalle }>('/muestras', cuerpo).then(datos),
  receptar: (id: number) => api.patch<{ data: MuestraDetalle }>(`/muestras/${id}/receptar`).then(datos),
  procesar: (id: number) => api.patch<{ data: MuestraDetalle }>(`/muestras/${id}/procesar`).then(datos),
  rechazar: (id: number, motivoRechazo: string) =>
    api.patch<{ data: MuestraDetalle }>(`/muestras/${id}/rechazar`, { motivoRechazo }).then(datos),
};

export interface FiltrosResultados extends Paginacion {
  estado?: EstadoResultado;
  desde?: string;
  hasta?: string;
}

export const resultadosApi = {
  worklist: (soloPendientes: boolean) =>
    api
      .get<{ data: WorklistItem[] }>('/resultados/worklist', {
        params: { soloPendientes: soloPendientes ? 'true' : 'false' },
      })
      .then(datos),
  listar: (params: FiltrosResultados) =>
    api.get<Paginado<ResultadoDetalle>>('/resultados', { params }).then(pagina),
  obtener: (id: number) => api.get<{ data: ResultadoDetalle }>(`/resultados/${id}`).then(datos),
  registrar: (cuerpo: NuevoResultado) =>
    api.post<{ data: ResultadoDetalle }>('/resultados', cuerpo).then(datos),
  actualizar: (id: number, cuerpo: HallazgosEntrada) =>
    api.put<{ data: ResultadoDetalle }>(`/resultados/${id}`, cuerpo).then(datos),
  validar: (id: number) => api.patch<{ data: ResultadoDetalle }>(`/resultados/${id}/validar`).then(datos),
};
