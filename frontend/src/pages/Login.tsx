import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { RegistroForm } from '../components/RegistroForm';
import { BrandIcon, PublicInformation, PublicIntroduction, ScientificAtmosphere } from '../components/public/PublicContent';
import { PublicNavigation, usePublicExperience } from '../components/public/PublicNavigation';
import { Alert } from '../components/UI/Alert';
import { useAuth } from '../context/AuthContext';
import { mensajeDeError } from '../services/api';
import '../public.css';

function LoginForm() {
  const { iniciarSesion } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bloqueado = useRef(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!username.trim() || !password || bloqueado.current) return;
    bloqueado.current = true;
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(username.trim(), password);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      bloqueado.current = false;
      setEnviando(false);
    }
  }

  return <>
    <form onSubmit={enviar} aria-label="Inicio de sesión" aria-busy={enviando}>
      <p className="access-hint">Ingresa tu usuario o correo y contraseña.</p>
      <label className="field" htmlFor="usuario">Usuario</label>
      <input className="public-input" id="usuario" name="username" value={username}
        onChange={(e) => { setUsername(e.target.value); setError(null); }}
        autoComplete="username" autoCapitalize="none" spellCheck={false}
        placeholder="Ingresa tu usuario o correo" maxLength={120} required disabled={enviando} />
      <label className="field" htmlFor="password">Contraseña</label>
      <div className="passwrap">
        <input className="public-input" id="password" name="password" type={mostrarPassword ? 'text' : 'password'}
          value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
          autoComplete="current-password" placeholder="Ingresa tu contraseña" required disabled={enviando} />
        <button type="button" onClick={() => setMostrarPassword((v) => !v)} disabled={enviando}
          aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarPassword}>
          {mostrarPassword ? <EyeOff size={20} strokeWidth={1.65} aria-hidden /> : <Eye size={20} strokeWidth={1.65} aria-hidden />}
        </button>
      </div>
      <div className="formrow">
        <label title="La duración de la sesión la administra el sistema"><input type="checkbox" disabled /> Recordar mi sesión</label>
        <span className="unavailable" title="Contacta al administrador del laboratorio para recuperar el acceso" tabIndex={0}>
          Recuperación: administrador
        </span>
      </div>
      <button className="primary" type="submit" disabled={!username.trim() || !password || enviando}>
        {enviando && <Loader2 size={18} className="public-spinner" aria-hidden />}
        {enviando ? 'Verificando acceso...' : 'Iniciar sesión'} {!enviando && <span aria-hidden>→</span>}
      </button>
      <div className="public-notice" aria-live="polite">{error && <Alert>{error}</Alert>}</div>
    </form>
    <div className="signup">¿Aún no tienes una cuenta?<br /><Link to="/registro" aria-label="Crear cuenta">Crear una cuenta <span aria-hidden>↗</span></Link></div>
  </>;
}

export default function Login() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  const registro = location.pathname === '/registro';
  const pagina = useRef<HTMLElement>(null);
  const { progreso, seccion } = usePublicExperience(pagina, registro, !cargando && !usuario);
  const destino = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (cargando) return <PantallaCarga />;
  if (usuario) return <Navigate to={destino} replace />;

  return (
    <main className="labzen-public" ref={pagina}>
      <PublicNavigation progreso={progreso} seccion={seccion} registro={registro} />
      <section className="hero" id="inicio" aria-label="Acceso a LabZen">
        <ScientificAtmosphere />
        <PublicIntroduction />
        <div className="right">
          <div className={`panel${registro ? ' registration-panel' : ''}`}>
            <div className="panel-top"><span>ACCESO SEGURO</span><span>LabZen · v0.2.0</span></div>
            <div className="emblem"><BrandIcon /></div>
            <h2>{registro ? 'Crear cuenta' : 'Tu espacio de trabajo'}</h2>
            <p className="subtitle">{registro ? 'Solicita acceso para formar parte del laboratorio' : 'Accede a LabZen con tu cuenta institucional'}</p>
            {registro ? <RegistroForm /> : <LoginForm />}
            <p className="panel-security"><span className="security-dot" /> Acceso protegido por roles · Datos privados</p>
          </div>
        </div>
      </section>
      <PublicInformation />
    </main>
  );
}

export function PantallaCarga() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-lamina text-slate-500" role="status">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violeta-200 border-t-violeta-700" />
      <span>Cargando sesión...</span>
    </div>
  );
}
