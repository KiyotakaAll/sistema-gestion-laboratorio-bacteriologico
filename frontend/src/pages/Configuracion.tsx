
import { useState } from 'react';
import {
  Bell,
  Check,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL } from '../components/navigation';

type Tema = 'claro' | 'oscuro' | 'sistema';

const OPCIONES_TEMA: {
  valor: Tema;
  nombre: string;
  descripcion: string;
  icono: typeof Sun;
}[] = [
  {
    valor: 'claro',
    nombre: 'Claro',
    descripcion: 'Interfaz luminosa',
    icono: Sun,
  },
  {
    valor: 'oscuro',
    nombre: 'Oscuro',
    descripcion: 'Interfaz oscura',
    icono: Moon,
  },
  {
    valor: 'sistema',
    nombre: 'Automático',
    descripcion: 'Según tu dispositivo',
    icono: Monitor,
  },
];

export default function Configuracion() {
  const { usuario } = useAuth();
  const [tema, setTema] = useState<Tema>('claro');

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B65B5]">
          Preferencias personales
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[#30213D]">
          Configuración
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Consulta tu perfil y personaliza tu experiencia en la plataforma.
        </p>
      </div>

      {/* Perfil */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E0EE] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#F0EAF5] px-6 py-5">
          <div className="rounded-xl bg-[#F3ECFA] p-2.5">
            <UserRound className="h-5 w-5 text-[#7545A5]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#30213D]">
              Mi perfil
            </h2>
            <p className="text-xs text-slate-500">
              Información de tu cuenta institucional
            </p>
          </div>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
              Usuario
            </p>
            <div className="rounded-xl border border-[#EAE4EF] bg-[#FAF8FC] px-4 py-3 text-sm text-[#30213D]">
              {usuario?.username ?? 'No disponible'}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
              Rol asignado
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-[#EAE4EF] bg-[#FAF8FC] px-4 py-3 text-sm text-[#30213D]">
              <ShieldCheck className="h-4 w-4 text-[#7545A5]" />
              {usuario
                ? ETIQUETA_ROL[usuario.rol]
                : 'No disponible'}
            </div>
          </div>
        </div>
      </section>

      {/* Apariencia */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E0EE] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#F0EAF5] px-6 py-5">
          <div className="rounded-xl bg-[#F3ECFA] p-2.5">
            <Palette className="h-5 w-5 text-[#7545A5]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#30213D]">
              Apariencia
            </h2>
            <p className="text-xs text-slate-500">
              Elige cómo prefieres visualizar la plataforma
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {OPCIONES_TEMA.map((opcion) => {
            const Icono = opcion.icono;
            const seleccionado = tema === opcion.valor;

            return (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => setTema(opcion.valor)}
                aria-pressed={seleccionado}
                className={[
                  'relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7545A5]',
                  seleccionado
                    ? 'border-[#7545A5] bg-[#F8F2FD]'
                    : 'border-[#EAE4EF] bg-white hover:border-[#CDB5E2]',
                ].join(' ')}
              >
                {seleccionado && (
                  <Check className="absolute right-3 top-3 h-4 w-4 text-[#7545A5]" />
                )}

                <div className="mb-4 rounded-lg bg-[#F0E6F8] p-3">
                  <Icono className="h-5 w-5 text-[#7545A5]" />
                </div>

                <span className="text-sm font-semibold text-[#30213D]">
                  {opcion.nombre}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {opcion.descripcion}
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-6 pb-5 text-xs text-slate-500">
          El selector es una vista preliminar. Aplicaremos los temas a
          toda la plataforma en el siguiente paso.
        </p>
      </section>

      {/* Notificaciones */}
      <section className="flex items-start gap-4 rounded-2xl border border-[#E8E0EE] bg-white p-6 shadow-sm">
        <div className="rounded-xl bg-[#F3ECFA] p-2.5">
          <Bell className="h-5 w-5 text-[#7545A5]" />
        </div>
        <div>
          <h2 className="font-semibold text-[#30213D]">
            Notificaciones
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Las preferencias de notificaciones estarán disponibles
            cuando integremos esta funcionalidad.
          </p>
        </div>
      </section>

      {/* Seguridad */}
      <section className="flex items-start gap-4 rounded-2xl border border-[#E8E0EE] bg-white p-6 shadow-sm">
        <div className="rounded-xl bg-[#F3ECFA] p-2.5">
          <LockKeyhole className="h-5 w-5 text-[#7545A5]" />
        </div>
        <div>
          <h2 className="font-semibold text-[#30213D]">
            Seguridad de la cuenta
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Próximamente podrás gestionar tu contraseña y otras
            opciones de seguridad desde esta sección.
          </p>
        </div>
      </section>
    </div>
  );
}
