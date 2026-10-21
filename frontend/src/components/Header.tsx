import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './UI/Button';
import { ETIQUETA_ROL, NAVEGACION } from './navigation';

export function Header() {
  const { usuario, cerrarSesion } = useAuth();
  const { pathname } = useLocation();
  const titulo = NAVEGACION.find((item) => pathname.startsWith(item.ruta))?.titulo ?? 'Laboratorio Bacteriológico';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5">
      <h1 className="font-serif text-xl font-semibold text-violeta-900">{titulo}</h1>
      {usuario && (
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-slate-900">{usuario.nombreCompleto}</p>
            <p className="text-xs text-slate-500">{ETIQUETA_ROL[usuario.rol]}</p>
          </div>
          <Button tamano="sm" onClick={cerrarSesion} icono={<LogOut className="h-3.5 w-3.5" aria-hidden />}>
            Cerrar sesión
          </Button>
        </div>
      )}
    </header>
  );
}
