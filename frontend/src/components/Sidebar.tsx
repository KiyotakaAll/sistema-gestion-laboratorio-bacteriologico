import { IconoCerrarSesion, IconoConfiguracion } from './icons/LabZenIcon';
import { useId, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { etiquetaPerfil, NAVEGACION } from './navigation';
import { LabZenBrand } from './branding/LabZenBrand';

interface Props {
  id: string;
  contraido: boolean;
  onNavegar?: () => void;
}

export function Sidebar({ id, contraido, onNavegar }: Props) {
  const { usuario, puede, cerrarSesion } = useAuth();
  const items = NAVEGACION.filter((item) => item.ruta !== '/configuracion' && puede(item.permiso));
  const idAyuda = useId();
  const [ayuda, setAyuda] = useState<{ etiqueta: string; top: number; left: number } | null>(null);

  function mostrarAyuda(evento: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>, etiqueta: string) {
    if (!contraido) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    setAyuda({ etiqueta, top: caja.top + caja.height / 2, left: caja.right + 12 });
  }

  function navegar() { setAyuda(null); onNavegar?.(); }

  return (
    <aside id={id} className="lz-sidebar" data-contraido={contraido} aria-label="Navegación del laboratorio">
      <div className="lz-sidebar-brand">
        <span className="lz-brand-mark" role={contraido ? 'img' : undefined}
          aria-label={contraido ? 'LabZen' : undefined} title={contraido ? 'LabZen' : undefined}
          tabIndex={contraido ? 0 : undefined}
          aria-describedby={contraido && ayuda?.etiqueta === 'LabZen' ? idAyuda : undefined}
          onFocus={(e) => mostrarAyuda(e, 'LabZen')} onBlur={() => setAyuda(null)}
          onMouseEnter={(e) => mostrarAyuda(e, 'LabZen')} onMouseLeave={() => setAyuda(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setAyuda(null); }}>
          <LabZenBrand variant="blanco" size={32} />
        </span>
        <div className="lz-sidebar-label"><strong>Lab<span>Zen</span></strong><p>Laboratorio bacteriológico</p></div>
      </div>
      <nav aria-label="Principal" className="lz-sidebar-nav" onScroll={() => setAyuda(null)}>
        <p className="lz-nav-label lz-sidebar-label">Espacio de trabajo</p>
        <ul>
          {items.map(({ ruta, etiqueta, icono: Icono }) => (
            <li key={ruta}>
              <NavLink to={ruta} end aria-label={etiqueta} title={contraido ? etiqueta : undefined}
                aria-describedby={contraido && ayuda?.etiqueta === etiqueta ? idAyuda : undefined}
                onClick={navegar} onFocus={(e) => mostrarAyuda(e, etiqueta)} onBlur={() => setAyuda(null)}
                onMouseEnter={(e) => mostrarAyuda(e, etiqueta)} onMouseLeave={() => setAyuda(null)}
                onKeyDown={(e) => { if (e.key === 'Escape') setAyuda(null); }}
                className={({ isActive }) => `lz-nav-link${isActive ? ' lz-nav-active' : ''}`}>
                <Icono size={20} strokeWidth={1.7} aria-hidden />
                <span className="lz-sidebar-label">{etiqueta}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="lz-sidebar-footer">
        <div className="lz-sidebar-role" title={usuario ? etiquetaPerfil(usuario) : undefined}>
          <span className="lz-sidebar-avatar" aria-hidden>{usuario?.nombreCompleto.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() ?? 'LZ'}</span>
          <div className="lz-sidebar-label"><strong>{usuario?.nombreCompleto ?? 'Usuario'}</strong><span>{usuario ? etiquetaPerfil(usuario) : 'Perfil de acceso'}</span></div>
        </div>
        <div className="lz-sidebar-actions" role="group" aria-label="Cuenta y preferencias">
          {puede('configuracion.ver') && <NavLink to="/configuracion" aria-label="Configuración" title="Configuración" onClick={navegar}
            className={({ isActive }) => `lz-sidebar-action${isActive ? ' lz-nav-active' : ''}`}>
            <IconoConfiguracion size={19} strokeWidth={1.7} aria-hidden /><span className="lz-sidebar-label">Configuración</span>
          </NavLink>}
          <button type="button" aria-label="Cerrar sesión" title="Cerrar sesión" className="lz-sidebar-action" onClick={cerrarSesion}>
            <IconoCerrarSesion size={19} strokeWidth={1.7} aria-hidden /><span className="lz-sidebar-label">Cerrar sesión</span>
          </button>
        </div>
        <p className="lz-version lz-sidebar-label">Interfaz v0.2.0</p>
      </div>
      {contraido && ayuda && createPortal(
        <span id={idAyuda} role="tooltip" className="labzen-internal lz-sidebar-tooltip" style={{ top: ayuda.top, left: ayuda.left }}>{ayuda.etiqueta}</span>,
        document.body,
      )}
    </aside>
  );
}
