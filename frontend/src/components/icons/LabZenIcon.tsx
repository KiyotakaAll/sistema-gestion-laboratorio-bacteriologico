import type { ComponentType, SVGProps } from 'react';

// Geometría original del kit LabZen_Iconografia_v1/svg.
// Las copias SVG fuente se conservan en src/assets/icons/labzen/v1.
// Solo se adapta el color: sin estilos .accent globales ni cambios de trazado.
const dibujos = {
  'panel-general': <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  'pacientes': <><circle cx="10" cy="7" r="3" /><path d="M4.5 20v-2a5.5 5.5 0 0 1 11 0v2" /><path d="M17 5.2a3 3 0 0 1 0 5.6M18.5 14.2a5 5 0 0 1 2 4V20" /></>,
  'recepcion-muestras': <><path d="M4 8V5a2 2 0 0 1 2-2h3M15 3h3a2 2 0 0 1 2 2v3M20 16v3a2 2 0 0 1-2 2h-3M9 21H6a2 2 0 0 1-2-2v-3" /><path d="M10 6h4M10.5 7v8a1.5 1.5 0 0 0 3 0V7" /><path d="M8 17h8" /></>,
  'worklist': <><circle cx="12" cy="12" r="9" /><circle cx="9" cy="8.5" r="1.4" /><circle cx="15.5" cy="10" r="1.3" /><circle cx="11" cy="15.5" r="1.6" /><circle cx="16" cy="16" r=".6" /><circle cx="7.3" cy="12.5" r=".65" /></>,
  'validacion': <><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M15 3v5h4" /><path d="m8 15 3 3 5-6" /></>,
  'usuarios': <><circle cx="9" cy="7" r="3" /><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2" /><circle cx="18" cy="14" r="3" /><path d="M18 12.5v3m-1.5-1.5h3" /></>,
  'configuracion': <><path d="M9.7 3h4.6l.5 2.1 1.7.9 2-.8 2.4 4-1.5 1.5v2l1.5 1.5-2.4 4-2-.8-1.7.9-.5 2.1H9.7l-.5-2.1-1.7-.9-2 .8-2.4-4 1.5-1.5v-2L3.1 9.2l2.4-4 2 .8 1.7-.9Z" /><circle cx="12" cy="12" r="3" /></>,
  'cerrar-sesion': <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 7l5 5-5 5M9 12h10" /></>,
  'resultados': <><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M15 3v5h4M8 12h7M8 16h4" /><path d="m14 17 2 2 4-5" /></>,
  'muestras': <><path d="M8 3h8M7 5h10M9 5v12a3 3 0 0 0 6 0V5" /><path d="M9 13h6M10.5 16h3" /></>,
  'pendiente': <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'en-proceso': <><path d="M20 9a8 8 0 0 0-14-3L4 9m0-4v4h4M4 15a8 8 0 0 0 14 3l2-3m0 4v-4h-4" /></>,
  'rechazado': <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  'nuevo': <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  'solicitudes': <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4v-1h6v1M8 10h8M8 14h5" /><path d="M15 16v4m-2-2h4" /></>,
  'editar': <><path d="m5 16 11-11 3 3-11 11-4 1 1-4ZM14 7l3 3" /></>,
  'buscar': <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  'calendario': <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /><path d="M8 14h2m4 0h2m-8 4h2" /></>,
  'procesamiento': <><path d="M4 19h16M7 19v-2h10v2M8 7V4h8v3M10 7v7a2 2 0 0 0 4 0V7M18 10l2 2-2 2" /><path d="M10 11h4" /></>,
  'completado': <><circle cx="12" cy="12" r="9" /><path d="m7.5 12 3 3 6-6" /></>,
  'notificaciones': <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 20a2 2 0 0 0 4 0" /><circle cx="18" cy="5" r="2" /></>,
} as const;

export type LabZenIconName = keyof typeof dibujos;
export type LabZenIconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'ref' | 'name'> & { size?: number | string };
export type LabZenIconComponent = ComponentType<LabZenIconProps>;

export function LabZenIcon({ name, size = 24, strokeWidth = 1.7, ...props }: LabZenIconProps & { name: LabZenIconName }) {
  const label = props['aria-label'];
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} focusable="false"
    {...props} data-labzen-icon={name}>
    {label && <title>{label}</title>}
    {dibujos[name]}
  </svg>;
}

function crearIcono(name: LabZenIconName): LabZenIconComponent {
  return function Icono(props: LabZenIconProps) { return <LabZenIcon name={name} {...props} />; };
}

export const IconoPanelGeneral = crearIcono('panel-general');
export const IconoPacientes = crearIcono('pacientes');
export const IconoRecepcionMuestras = crearIcono('recepcion-muestras');
export const IconoWorklist = crearIcono('worklist');
export const IconoValidacion = crearIcono('validacion');
export const IconoUsuarios = crearIcono('usuarios');
export const IconoConfiguracion = crearIcono('configuracion');
export const IconoCerrarSesion = crearIcono('cerrar-sesion');
export const IconoResultados = crearIcono('resultados');
export const IconoMuestras = crearIcono('muestras');
export const IconoPendiente = crearIcono('pendiente');
export const IconoEnProceso = crearIcono('en-proceso');
export const IconoRechazado = crearIcono('rechazado');
export const IconoNuevo = crearIcono('nuevo');
export const IconoSolicitudes = crearIcono('solicitudes');
export const IconoEditar = crearIcono('editar');
export const IconoBuscar = crearIcono('buscar');
export const IconoCalendario = crearIcono('calendario');
export const IconoProcesamiento = crearIcono('procesamiento');
export const IconoCompletado = crearIcono('completado');
export const IconoNotificaciones = crearIcono('notificaciones');
