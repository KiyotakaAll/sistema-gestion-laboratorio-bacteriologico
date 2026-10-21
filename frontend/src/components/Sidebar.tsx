import { Microscope } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAVEGACION } from './navigation';

export function Sidebar() {
  const { tieneRol } = useAuth();
  const items = NAVEGACION.filter((item) => tieneRol(...item.roles));

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-violeta-950 text-violeta-100">
      <div className="flex items-center gap-2.5 border-b border-violeta-800 px-4 py-4">
        <Microscope className="h-7 w-7 shrink-0 text-violeta-300" aria-hidden />
        <div>
          <p className="font-serif text-base font-semibold leading-5 text-white">Laboratorio Bacteriológico</p>
          <p className="text-xs text-violeta-300">Sistema de gestión</p>
        </div>
      </div>
      <nav aria-label="Principal" className="flex-1 py-2">
        <ul>
          {items.map(({ ruta, etiqueta, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 border-l-4 px-4 py-2 text-sm ${
                    isActive
                      ? 'border-violeta-300 bg-violeta-800 font-semibold text-white'
                      : 'border-transparent hover:bg-violeta-900 hover:text-white'
                  }`
                }
              >
                <Icono className="h-4 w-4 shrink-0" aria-hidden />
                {etiqueta}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
