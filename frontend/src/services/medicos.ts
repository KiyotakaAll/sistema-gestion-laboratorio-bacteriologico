import { api } from './api';
import type { Paginado, SolicitudDetalle } from '../types/api';
import type { DatosMedico, EstadoMedicos, MedicoRemitente } from '../types/medicos';

export const medicosApi = {
  capacidades: () => api.get<{ data: { directorioMedicos: boolean } }>('/medicos/capacidades').then(r => r.data.data),
  listar: (params: { q?: string; estado?: EstadoMedicos; page?: number; pageSize?: number }) =>
    api.get<Paginado<MedicoRemitente>>('/medicos', { params }).then(r => r.data),
  obtener: (id: number) => api.get<{ data: MedicoRemitente }>(`/medicos/${id}`).then(r => r.data.data),
  crear: (body: DatosMedico) => api.post<{ data: MedicoRemitente }>('/medicos', body).then(r => r.data.data),
  actualizar: (id: number, body: DatosMedico) => api.put<{ data: MedicoRemitente }>(`/medicos/${id}`, body).then(r => r.data.data),
  estado: (id: number, activo: boolean) => api.patch<{ data: MedicoRemitente }>(`/medicos/${id}/estado`, { activo }).then(r => r.data.data),
  asignar: (id: number, medicoRemitenteId: number | null) =>
    api.patch<{ data: SolicitudDetalle }>(`/solicitudes/${id}/remitente`, { medicoRemitenteId }).then(r => r.data.data),
};
