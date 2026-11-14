
import { Microscope } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAVEGACION } from './navigation';

export function Sidebar() {
  const { tieneRol } = useAuth();
  const items = NAVEGACION.filter((item) => tieneRol(...item.roles));

  return (
    <aside className="flex w-[250px] shrink-0 flex-col bg-[#241833] text-[#F0EAF7]">

      {/* Identidad del laboratorio */}
      <div className="flex min-h-[100px] items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07]">
          <Microscope className="h-6 w-6 text-[#C5ADDF]" aria-hidden />
        </div>

        <div className="min-w-0">
          <p className="text-[13px] leading-5 text-[#D3CCDF]">
            Laboratorio
          </p>
          <p className="font-serif text-[16px] font-semibold leading-5 text-white">
            Bacteriológico
          </p>
          <p className="mt-1 text-[11px] text-[#BBA1D9]">
            Sistema de gestión
          </p>
        </div>
      </div>

      {/* Navegación */}
      <nav aria-label="Principal" className="flex-1 px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#A997BE]">
          Menú principal
        </p>

        <ul className="space-y-1.5">
          {items.map(({ ruta, etiqueta, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                className={({ isActive }) =>
                  `flex min-h-[43px] items-center gap-3 rounded-lg px-3 text-[13px] transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#60379A] font-semibold text-white shadow-sm'
                      : 'text-[#D3CCDF] hover:bg-white/[0.07] hover:text-white'
                  }`
                }
              >
                <Icono
                  className="h-[17px] w-[17px] shrink-0"
                  aria-hidden
                />
                <span>{etiqueta}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Pie del menú */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] text-[#BBA1D9]">
          Plataforma institucional
        </p>
      </div>
    </aside>
  );
}
