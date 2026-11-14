
import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './UI/Button';
import { ETIQUETA_ROL, NAVEGACION } from './navigation';

export function Header() {
  const { usuario, cerrarSesion } = useAuth();
  const { pathname } = useLocation();

  const titulo =
    NAVEGACION.find((item) => pathname.startsWith(item.ruta))?.titulo ??
    'Laboratorio Bacteriológico';

  return (
    <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#E2E7EE] bg-white px-6">

      {/* Título */}
      <div className="min-w-0">
        <h1 className="truncate font-serif text-[22px] font-semibold tracking-tight text-[#30203F]">
          {titulo}
        </h1>
      </div>

      {/* Usuario y sesión */}
      {usuario && (
        <div className="flex shrink-0 items-center gap-4">

          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-semibold text-[#30203F]">
              {usuario.nombreCompleto}
            </p>

            <p className="mt-1 text-[11px] text-[#68758A]">
              {ETIQUETA_ROL[usuario.rol]}
            </p>
          </div>

          <div className="h-8 w-px bg-[#E2E7EE]" />

          <Button
            tamano="sm"
            onClick={cerrarSesion}
            icono={
              <LogOut
                className="h-4 w-4"
                aria-hidden
              />
            }
          >
            Cerrar sesión
          </Button>
        </div>
      )}
    </header>
  );
}
