import axios from 'axios';
import { api } from './api';

export const documentosApi = {
  obtener: async (clase: 'informe' | 'orden' | 'remision', solicitudId?: number) => {
    const url = clase === 'remision' ? '/documentos/remision-vacia.pdf' : `/solicitudes/${solicitudId}/${clase}.pdf`;
    try { return (await api.get<Blob>(url, { responseType: 'blob' })).data; }
    catch (e) {
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try { e.response.data = JSON.parse(await e.response.data.text()); } catch { /* conservar error HTTP */ }
      }
      throw e;
    }
  },
};
