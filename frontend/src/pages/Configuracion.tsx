import { Bell, Monitor, Moon, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ETIQUETA_ROL } from '../components/navigation';
import { Button } from '../components/UI/Button';
import { useAuth } from '../context/AuthContext';
import { usePreferences, type Tema } from '../context/PreferencesContext';

const TEMAS = [
  { valor: 'claro', nombre: 'Claro', icono: Sun },
  { valor: 'oscuro', nombre: 'Oscuro', icono: Moon },
  { valor: 'sistema', nombre: 'Sistema', icono: Monitor },
] as const;

export default function Configuracion() {
  const { usuario } = useAuth();
  const { preferencias, actualizar, restablecer } = usePreferences();
  const [mensaje, setMensaje] = useState('');
  const cambiarTema = (tema: Tema) => { actualizar({ tema }); setMensaje('Tema actualizado.'); };
  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Preferencias personales</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-heading">Configuración</h1>
      <p className="mt-2 text-muted">Personalice LabZen en este navegador. Las preferencias se guardan automáticamente cuando el navegador permite almacenamiento local.</p>
    </div>
    <section className="settings-card" aria-labelledby="perfil-titulo">
      <h2 id="perfil-titulo" className="settings-title"><UserRound aria-hidden size={20} /> Mi perfil y sesión</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          ['Nombre completo', usuario?.nombreCompleto], ['Correo electrónico', usuario?.email ?? 'No disponible'],
          ['Usuario', usuario?.username], ['Rol asignado', usuario ? ETIQUETA_ROL[usuario.rol] : 'No disponible'],
        ].map(([etiqueta, valor]) => <div key={etiqueta} className="rounded-lg border border-line bg-subtle p-3">
          <dt className="text-xs text-muted">{etiqueta}</dt><dd className="mt-1 break-words font-semibold text-heading">{valor}</dd>
        </div>)}
      </dl>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted"><ShieldCheck size={16} aria-hidden /> Sesión autenticada. Al expirar deberá iniciar sesión nuevamente.</p>
      <p className="mt-2 text-xs text-muted">Para cambiar sus datos o permisos, contacte al responsable del laboratorio.</p>
    </section>
    <section className="settings-card" aria-labelledby="apariencia-titulo">
      <h2 id="apariencia-titulo" className="settings-title"><Palette aria-hidden size={20} /> Apariencia</h2>
      <div className="mt-5 grid grid-cols-3 gap-3" role="group" aria-label="Tema de la interfaz">
        {TEMAS.map(({ valor, nombre, icono: Icono }) => <button key={valor} type="button" aria-pressed={preferencias.tema === valor}
          onClick={() => cambiarTema(valor)} className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 font-semibold transition-colors ${preferencias.tema === valor ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-body hover:border-accent'}`}>
          <Icono size={20} aria-hidden />{nombre}
        </button>)}
      </div>
      <p className="mt-3 text-xs text-muted">Sistema sigue automáticamente la apariencia de su dispositivo.</p>
      <fieldset className="mt-5 border-t border-line pt-4">
        <legend className="font-semibold text-heading">Densidad visual</legend>
        <div className="mt-2 flex gap-6">
          {(['comoda', 'compacta'] as const).map((densidad) => <label key={densidad} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="densidad" value={densidad} checked={preferencias.densidad === densidad} onChange={() => actualizar({ densidad })} />
            {densidad === 'comoda' ? 'Cómoda' : 'Compacta'}
          </label>)}
        </div>
        <p className="mt-2 text-xs text-muted">Ajusta el espacio de tablas, campos y botones.</p>
      </fieldset>
      <label className="mt-5 flex cursor-pointer items-center gap-3"><input type="checkbox" checked={preferencias.reducirMovimiento} onChange={(e) => actualizar({ reducirMovimiento: e.target.checked })} /> Reducir animaciones y transiciones</label>
      <p className="mt-2 text-xs text-muted">También se respeta la preferencia de movimiento reducido del sistema.</p>
    </section>
    <section className="settings-card" aria-labelledby="avisos-titulo">
      <h2 id="avisos-titulo" className="settings-title"><Bell aria-hidden size={20} /> Avisos visuales</h2>
      <label className="mt-4 flex cursor-pointer items-center gap-3"><input type="checkbox" checked={preferencias.avisosInformativos} onChange={(e) => actualizar({ avisosInformativos: e.target.checked })} /> Mostrar avisos de éxito e información</label>
      <p className="mt-2 text-xs text-muted">Controla los avisos emergentes de la interfaz. Los errores y las validaciones siempre se muestran.</p>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Button onClick={() => { restablecer(); setMensaje('Preferencias restablecidas.'); }}>Restablecer preferencias</Button>
      <p role="status" className="text-sm text-muted">{mensaje}</p>
    </div>
  </div>;
}
