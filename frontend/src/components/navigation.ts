import { FileCheck2, FlaskConical, LayoutDashboard, TestTubes, UserPlus, type LucideIcon } from 'lucide-react';
import type { RolNombre } from '../types/api';

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  /** Título mostrado en la cabecera. */
  titulo: string;
  icono: LucideIcon;
  /** Roles con acceso. Se aplica igual al menú y a la protección de la ruta. */
  roles: RolNombre[];
}

const TODOS: RolNombre[] = ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'];

export const NAVEGACION: ItemNavegacion[] = [
  { ruta: '/dashboard', etiqueta: 'Panel general', titulo: 'Panel general', icono: LayoutDashboard, roles: TODOS },
  {
    ruta: '/admision',
    etiqueta: 'Admisión de pacientes',
    titulo: 'Admisión de pacientes y solicitudes',
    icono: UserPlus,
    roles: ['ADMINISTRADOR', 'RECEPCIONISTA'],
  },
  {
    ruta: '/recepcion',
    etiqueta: 'Recepción de muestras',
    titulo: 'Control y trazabilidad de muestras',
    icono: TestTubes,
    roles: ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO'],
  },
  {
    ruta: '/worklist',
    etiqueta: 'Worklist bacteriológico',
    titulo: 'Worklist bacteriológico',
    icono: FlaskConical,
    roles: ['ADMINISTRADOR', 'BACTERIOLOGO'],
  },
  {
    ruta: '/validacion',
    etiqueta: 'Validación de resultados',
    titulo: 'Validación formal de resultados',
    icono: FileCheck2,
    roles: ['ADMINISTRADOR', 'VALIDADOR'],
  },
];

export function rolesDeRuta(ruta: string): RolNombre[] {
  return NAVEGACION.find((item) => item.ruta === ruta)?.roles ?? [];
}

export const ETIQUETA_ROL: Record<RolNombre, string> = {
  ADMINISTRADOR: 'Administrador',
  RECEPCIONISTA: 'Recepción',
  BACTERIOLOGO: 'Bacteriólogo',
  VALIDADOR: 'Validador',
};
