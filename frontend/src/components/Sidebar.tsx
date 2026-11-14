
import { ChevronRight, Microscope, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL, NAVEGACION } from './navigation';

export function Sidebar() {
  const { tieneRol } = useAuth();

  const items = NAVEGACION.filter((item) =>
    tieneRol(...item.roles),
  );

  const rolActual = (
    [
      'ADMINISTRADOR',
      'RECEPCIONISTA',
      'BACTERIOLOGO',
      'VALIDADOR',
    ] as const
  ).find((rol) => tieneRol(rol));

  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-[#241833] text-[#F0EAF7]">
      {/* Identidad institucional */}
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] shadow-sm">
            <Microscope
              className="h-6 w-6 text-[#D9BDF5]"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#BBA1D9]">
              Laboratorio
            </p>

            <p className="font-serif text-[17px] font-semibold leading-6 text-white">
              Bacteriológico
            </p>

            <p className="text-[11px] text-[#C5B5D8]">
              Sistema de gestión
            </p>
          </div>
        </div>
      </div>

      {/* Navegación principal */}
      <nav
        aria-label="Principal"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-6"
      >
        <div className="mb-4 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A997BE]">
            Menú principal
          </p>

          <span
            className="h-1.5 w-1.5 rounded-full bg-[#C6A5EC]"
            aria-hidden="true"
          />
        </div>

        <ul className="space-y-1.5">
          {items.map(({ ruta, etiqueta, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                end
                className={({ isActive }) =>
                  [
                    'group relative flex min-h-[46px] items-center gap-3',
                    'rounded-xl px-3 py-2.5',
                    'text-[13px] transition-all duration-150',
                    'focus-visible:outline-none',
                    'focus-visible:ring-2',
                    'focus-visible:ring-[#D8B9FA]',
                    'focus-visible:ring-offset-2',
                    'focus-visible:ring-offset-[#241833]',
                    isActive
                      ? 'bg-[#60379A] font-semibold text-white shadow-md'
                      : 'text-[#D3CCDF] hover:bg-white/[0.08] hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#E2C7FF]"
                        aria-hidden="true"
                      />
                    )}

                    <span
                      className={[
                        'flex h-8 w-8 shrink-0 items-center justify-center',
                        'rounded-lg transition-colors',
                        isActive
                          ? 'bg-white/[0.12] text-white'
                          : 'bg-white/[0.04] text-[#C9B5E1] group-hover:bg-white/[0.08]',
                      ].join(' ')}
                    >
                      <Icono
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="min-w-0 flex-1 leading-5">
                      {etiqueta}
                    </span>

                    <ChevronRight
                      className={[
                        'h-4 w-4 shrink-0 transition-all',
                        isActive
                          ? 'translate-x-0 text-[#E8D6FA] opacity-100'
                          : '-translate-x-1 text-[#BBA1D9] opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie del menú */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5A3784]/60">
            <ShieldCheck
              className="h-[18px] w-[18px] text-[#D8B9FA]"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] text-[#BBA1D9]">
              Perfil de acceso
            </p>

            <p className="truncate text-[12px] font-semibold text-white">
              {rolActual ? ETIQUETA_ROL[rolActual] : 'Usuario'}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-[#A997BE]">
          Plataforma institucional
        </p>
      </div>
    </aside>
  );
}
