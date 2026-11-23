
import { Microscope } from 'lucide-react';
import { IconoPanelGeneral, IconoPacientes, IconoRecepcionMuestras, IconoWorklist, IconoValidacion, IconoUsuarios, IconoConfiguracion, type LabZenIconComponent } from './icons/LabZenIcon';

import type { RolNombre } from '../types/api';

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  /** Título mostrado en la cabecera. */
  titulo: string;
  icono: LabZenIconComponent;
  /** Roles con acceso. Se aplica igual al menú y a la protección de la ruta. */
  roles: RolNombre[];
}

const TODOS: RolNombre[] = [
  'ADMINISTRADOR',
  'RECEPCIONISTA',
  'BACTERIOLOGO',
  'VALIDADOR',
];

export const NAVEGACION: ItemNavegacion[] = [
  {
    ruta: '/dashboard',
    etiqueta: 'Panel general',
    titulo: 'Panel general',
    icono: IconoPanelGeneral,
    roles: TODOS,
  },
  {
    ruta: '/admision',
    etiqueta: 'Admisión de pacientes',
    titulo: 'Admisión de pacientes y solicitudes',
    icono: IconoPacientes,
    roles: ['ADMINISTRADOR', 'RECEPCIONISTA'],
  },
  {
    ruta: '/medicos',
    etiqueta: 'Médicos remitentes',
    titulo: 'Directorio de médicos remitentes',
    icono: IconoUsuarios,
    roles: TODOS,
  },
  {
    ruta: '/recepcion',
    etiqueta: 'Recepción de muestras',
    titulo: 'Control y trazabilidad de muestras',
    icono: IconoRecepcionMuestras,
    roles: ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO'],
  },
  {
    ruta: '/worklist',
    etiqueta: 'Worklist bacteriológico',
    titulo: 'Worklist bacteriológico',
    icono: IconoWorklist,
    roles: ['ADMINISTRADOR', 'BACTERIOLOGO'],
  },
  {
    ruta: '/validacion',
    etiqueta: 'Consulta y validación',
    titulo: 'Consulta y validación de resultados',
    icono: IconoValidacion,
    roles: ['ADMINISTRADOR', 'BACTERIOLOGO', 'VALIDADOR'],
  },
  {
    ruta: '/usuarios',
    etiqueta: 'Gestión de usuarios',
    titulo: 'Gestión de usuarios',
    icono: IconoUsuarios,
    roles: ['ADMINISTRADOR'],
  },
  {
    ruta: '/configuracion',
    etiqueta: 'Configuración',
    titulo: 'Configuración y preferencias',
    icono: IconoConfiguracion,
    roles: TODOS,
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

export const ICONO_LABORATORIO = Microscope;
