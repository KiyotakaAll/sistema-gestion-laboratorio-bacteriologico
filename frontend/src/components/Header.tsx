
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL, NAVEGACION } from './navigation';

export function Header() {
  const { usuario } = useAuth();
  const { pathname } = useLocation();

  const titulo =
    NAVEGACION.find((item) => pathname.startsWith(item.ruta))?.titulo ??
    'Laboratorio Bacteriológico';

  return (
    <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">

      {/* Título */}
      <div className="min-w-0">
        <h1 className="truncate font-serif text-[22px] font-semibold tracking-tight text-heading">
          {titulo}
        </h1>
      </div>

      {/* Usuario y sesión */}
      {usuario && (
        <div className="flex shrink-0 items-center gap-4">

          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-semibold text-heading">
              {usuario.nombreCompleto}
            </p>

            <p className="mt-1 text-[11px] text-muted">
              {ETIQUETA_ROL[usuario.rol]}
            </p>
          </div>

        </div>
      )}
    </header>
  );
}
