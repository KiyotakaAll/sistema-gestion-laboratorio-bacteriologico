
import { Microscope } from 'lucide-react';
import { IconoPanelGeneral, IconoPacientes, IconoRecepcionMuestras, IconoWorklist, IconoValidacion, IconoUsuarios, IconoConfiguracion, type LabZenIconComponent } from './icons/LabZenIcon';

import type { RolNombre, UsuarioSesion } from '../types/api';
import type { Permiso } from '../utils/permisos';

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  /** Título mostrado en la cabecera. */
  titulo: string;
  icono: LabZenIconComponent;
  /** Misma capacidad para el menú y el acceso directo a la ruta. */
  permiso: Permiso;
}

export const NAVEGACION: ItemNavegacion[] = [
  {
    ruta: '/dashboard',
    etiqueta: 'Panel general',
    titulo: 'Panel general',
    icono: IconoPanelGeneral,
    permiso: 'panel.ver',
  },
  {
    ruta: '/admision',
    etiqueta: 'Admisión de pacientes',
    titulo: 'Admisión de pacientes y solicitudes',
    icono: IconoPacientes,
    permiso: 'admision.acceder',
  },
  {
    ruta: '/medicos',
    etiqueta: 'Médicos remitentes',
    titulo: 'Directorio de médicos remitentes',
    icono: IconoUsuarios,
    permiso: 'medicos.leer',
  },
  {
    ruta: '/recepcion',
    etiqueta: 'Recepción de muestras',
    titulo: 'Control y trazabilidad de muestras',
    icono: IconoRecepcionMuestras,
    permiso: 'recepcion.acceder',
  },
  {
    ruta: '/worklist',
    etiqueta: 'Worklist bacteriológico',
    titulo: 'Worklist bacteriológico',
    icono: IconoWorklist,
    permiso: 'resultados.worklist',
  },
  {
    ruta: '/validacion',
    etiqueta: 'Consulta y validación',
    titulo: 'Consulta y validación de resultados',
    icono: IconoValidacion,
    permiso: 'resultados.leer',
  },
  {
    ruta: '/usuarios',
    etiqueta: 'Gestión de usuarios',
    titulo: 'Gestión de usuarios',
    icono: IconoUsuarios,
    permiso: 'usuarios.administrar',
  },
  {
    ruta: '/configuracion',
    etiqueta: 'Configuración',
    titulo: 'Configuración y preferencias',
    icono: IconoConfiguracion,
    permiso: 'configuracion.ver',
},
];

export function permisoDeRuta(ruta: string): Permiso | undefined {
  return NAVEGACION.find((item) => item.ruta === ruta)?.permiso;
}

export const ETIQUETA_ROL: Record<RolNombre, string> = {
  AUXILIAR: 'Auxiliar',
  ADMINISTRADOR: 'Administrador',
  RECEPCIONISTA: 'Recepción',
  BACTERIOLOGO: 'Bacteriólogo',
  VALIDADOR: 'Validador',
};

export const ICONO_LABORATORIO = Microscope;

export function etiquetaPerfil(usuario: UsuarioSesion): string {
  return ETIQUETA_ROL[usuario.autorizacion?.perfilOperativo ?? usuario.rol];
}
