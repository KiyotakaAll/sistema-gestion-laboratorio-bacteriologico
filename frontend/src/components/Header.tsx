import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL, NAVEGACION } from './navigation';

interface Props {
  esMovil: boolean;
  menuExpandido: boolean;
  onAlternarMenu: () => void;
}

export function Header({ esMovil, menuExpandido, onAlternarMenu }: Props) {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  const titulo = NAVEGACION.find((item) => pathname.startsWith(item.ruta))?.etiqueta ?? 'Laboratorio Bacteriológico';
  const Icono = esMovil ? Menu : menuExpandido ? PanelLeftClose : PanelLeftOpen;
  const etiqueta = esMovil ? 'Abrir menú de navegación' : menuExpandido ? 'Contraer menú' : 'Expandir menú';

  return (
    <header className="lz-header">
      <div className="lz-header-start">
        <button type="button" className="lz-menu-toggle" onClick={onAlternarMenu}
          aria-label={etiqueta} title={etiqueta} aria-expanded={menuExpandido}
          aria-controls="navegacion-interna" aria-haspopup={esMovil ? 'dialog' : undefined}>
          <Icono size={20} strokeWidth={1.8} aria-hidden />
        </button>
        <p className="lz-breadcrumb"><span>LabZen</span><span aria-hidden>/</span><span>{titulo}</span></p>
      </div>
      {usuario && <div className="lz-header-profile">
        <div className="lz-header-identity">
          <p>{usuario.nombreCompleto}</p>
        </div>
        <span className="lz-header-role">{ETIQUETA_ROL[usuario.rol]}</span>
        <span className="lz-avatar" aria-hidden>{usuario.nombreCompleto.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()}</span>
      </div>}
    </header>
  );
}
