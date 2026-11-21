import { Monitor, Moon, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { IconoNotificaciones } from '../components/icons/LabZenIcon';
import { useState } from 'react';
import { ETIQUETA_ROL } from '../components/navigation';
import { PageHeader } from '../components/UI/PageHeader';
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
  return <>
    <PageHeader contexto="Preferencias personales" titulo="Configuración"
      descripcion="Personaliza tu espacio de trabajo y consulta la información de tu sesión." />
    <div className="lz-settings-grid">
      <section className="lz-panel lz-settings-appearance" aria-labelledby="apariencia-titulo">
        <h2 id="apariencia-titulo" className="settings-title"><Palette aria-hidden size={20} /> Apariencia</h2>
        <p className="lz-section-description">Elige cómo quieres trabajar en este navegador.</p>
        <div className="lz-theme-options" role="group" aria-label="Tema de la interfaz">
          {TEMAS.map(({ valor, nombre, icono: Icono }) => <button key={valor} type="button" aria-pressed={preferencias.tema === valor}
            onClick={() => cambiarTema(valor)} className={`lz-theme-option ${preferencias.tema === valor ? 'lz-selected' : ''}`}>
            <span className={`lz-theme-preview lz-preview-${valor}`} aria-hidden><i /><span><i /><i /><i /></span></span>
            <span><Icono size={17} aria-hidden />{nombre}</span>
          </button>)}
        </div>
        <p className="lz-preference-note">Sistema sigue automáticamente la apariencia de su dispositivo.</p>
        <fieldset className="lz-density-options">
          <legend>Densidad visual</legend>
          <p className="lz-section-description">Ajusta el espacio de tablas, campos y botones.</p>
          <div>{(['comoda', 'compacta'] as const).map((densidad) => <label key={densidad} className={preferencias.densidad === densidad ? 'lz-selected' : ''}>
            <input aria-label={densidad === 'comoda' ? 'Cómoda' : 'Compacta'} type="radio" name="densidad" value={densidad} checked={preferencias.densidad === densidad} onChange={() => actualizar({ densidad })} />
            <span><strong>{densidad === 'comoda' ? 'Cómoda' : 'Compacta'}</strong><small>{densidad === 'comoda' ? 'Más espacio para leer' : 'Más información a la vista'}</small></span>
          </label>)}</div>
        </fieldset>
        <div className="lz-preference-row"><div><label htmlFor="preferencia-movimiento">Reducir animaciones y transiciones</label>
          <p>También se respeta la preferencia de movimiento reducido del sistema.</p></div>
          <input id="preferencia-movimiento" type="checkbox" checked={preferencias.reducirMovimiento} onChange={(e) => actualizar({ reducirMovimiento: e.target.checked })} />
        </div>
      </section>
      <div className="lz-settings-aside">
        <section className="lz-panel" aria-labelledby="perfil-titulo">
          <h2 id="perfil-titulo" className="settings-title"><UserRound aria-hidden size={20} /> Mi perfil y sesión</h2>
          <div className="lz-profile-card"><span className="lz-profile-mark" aria-hidden>{usuario?.nombreCompleto.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}</span>
            <div><strong>{usuario?.nombreCompleto}</strong><span>{usuario ? ETIQUETA_ROL[usuario.rol] : 'No disponible'}</span></div></div>
          <dl className="lz-profile-details">
            {[
              ['Nombre completo', usuario?.nombreCompleto], ['Correo electrónico', usuario?.email ?? 'No disponible'],
              ['Usuario', usuario?.username], ['Rol asignado', usuario ? ETIQUETA_ROL[usuario.rol] : 'No disponible'],
            ].map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
          </dl>
          <p className="lz-session-note"><ShieldCheck size={16} aria-hidden /> Sesión autenticada. Al expirar deberá iniciar sesión nuevamente.</p>
          <p className="lz-preference-note">Para cambiar sus datos o permisos, contacte al responsable del laboratorio.</p>
        </section>
        <section className="lz-panel" aria-labelledby="avisos-titulo">
          <h2 id="avisos-titulo" className="settings-title"><IconoNotificaciones aria-hidden size={20} /> Avisos visuales</h2>
          <div className="lz-preference-row"><label htmlFor="preferencia-avisos">Mostrar avisos de éxito e información</label>
            <input id="preferencia-avisos" type="checkbox" checked={preferencias.avisosInformativos} onChange={(e) => actualizar({ avisosInformativos: e.target.checked })} /></div>
          <p className="lz-preference-note">Controla los avisos emergentes de la interfaz. Los errores y las validaciones siempre se muestran.</p>
        </section>
      </div>
    </div>
    <div className="lz-settings-footer">
      <p>Las preferencias se guardan automáticamente cuando el navegador permite almacenamiento local.</p>
      <Button onClick={() => { restablecer(); setMensaje('Preferencias restablecidas.'); }}>Restablecer preferencias</Button>
      <p role="status">{mensaje}</p>
    </div>
  </>;
}
