export interface MedicoRemitente {
  id: number;
  nombres: string;
  apellidos: string;
  registroProfesional: string | null;
  especialidad: string | null;
  telefono: string | null;
  email: string | null;
  institucion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
export type DatosMedico = Omit<MedicoRemitente, 'id' | 'activo' | 'createdAt' | 'updatedAt'>;
export type EstadoMedicos = 'todos' | 'activos' | 'inactivos';
export const nombreMedico = (m: Pick<MedicoRemitente, 'nombres' | 'apellidos'>) => `${m.nombres} ${m.apellidos}`;
