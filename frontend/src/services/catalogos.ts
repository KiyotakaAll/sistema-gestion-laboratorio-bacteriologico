import { api } from './api';
export interface SitioAnatomico { id: number; nombre: string; tiposMuestra: string[] }
export interface PlantillaExamenes { id: number; nombre: string; examenIds: number[] }
export interface CatalogoFlujo {
  habilitado: boolean; tiposMuestra: string[]; sitios: SitioAnatomico[]; plantillas: PlantillaExamenes[];
}
export interface ExamenSolicitadoEntrada { examenId: number; tipoMuestra: string; sitioAnatomicoId?: number }
export const catalogosApi = {
  flujo: () => api.get<{ data: CatalogoFlujo }>('/catalogos/flujo').then(r => r.data.data),
  crearSitio: (nombre: string, tiposMuestra: string[]) => api.post<{ data: SitioAnatomico }>('/catalogos/sitios', { nombre, tiposMuestra }).then(r => r.data.data),
  crearPlantilla: (nombre: string, examenIds: number[]) => api.post<{ data: PlantillaExamenes }>('/catalogos/plantillas', { nombre, examenIds }).then(r => r.data.data),
};
