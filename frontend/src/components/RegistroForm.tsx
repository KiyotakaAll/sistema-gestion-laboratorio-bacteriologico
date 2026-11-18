import { Eye, EyeOff } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/laboratorio';
import { detallesDeError, mensajeDeError } from '../services/api';
import { REGLA_PASSWORD, validarRegistro, type RegistroEntrada } from '../utils/registro';
import { Alert } from './UI/Alert';
import { Button } from './UI/Button';
import { Input } from './UI/Form';

export function RegistroForm() {
  const [datos, setDatos] = useState<RegistroEntrada>({ nombreCompleto: '', email: '', password: '', confirmacion: '' });
  const [errores, setErrores] = useState<Partial<Record<keyof RegistroEntrada, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [visibles, setVisibles] = useState({ password: false, confirmacion: false });
  const bloqueado = useRef(false);
  const formulario = useRef<HTMLFormElement>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (bloqueado.current) return;
    const nuevos = validarRegistro(datos);
    setErrores(nuevos);
    setError(null);
    if (Object.keys(nuevos).length) {
      const campo = Object.keys(nuevos)[0];
      formulario.current?.querySelector<HTMLInputElement>(`#registro-${campo}`)?.focus();
      return;
    }
    bloqueado.current = true;
    setEnviando(true);
    try {
      const respuesta = await authApi.registrar({ ...datos, email: datos.email.trim().toLowerCase(), nombreCompleto: datos.nombreCompleto.trim() });
      setDatos({ nombreCompleto: '', email: '', password: '', confirmacion: '' });
      setExito(respuesta.mensaje);
    } catch (err) {
      setError(mensajeDeError(err));
      const campos: typeof errores = {};
      for (const detalle of detallesDeError(err)) {
        if (['nombreCompleto', 'email', 'password', 'confirmacion'].includes(detalle.campo))
          campos[detalle.campo as keyof RegistroEntrada] = detalle.mensaje;
      }
      setErrores(campos);
    } finally { bloqueado.current = false; setEnviando(false); }
  }

  return <>
    {exito ? <Alert tipo="info">{exito}</Alert> : <form ref={formulario} onSubmit={enviar} className="login-form registro-form" noValidate aria-busy={enviando}>
      {error && <Alert>{error}</Alert>}
      {([
        ['nombreCompleto', 'Nombre completo', 'name'], ['email', 'Correo electrónico', 'email'],
        ['password', 'Contraseña', 'new-password'], ['confirmacion', 'Confirmar contraseña', 'new-password'],
      ] as const).map(([campo, etiqueta, autocomplete]) => {
        const secreto = campo === 'password' || campo === 'confirmacion';
        const visible = secreto && visibles[campo];
        return <div key={campo} className="login-field">
          <label htmlFor={`registro-${campo}`} className="mb-1.5 block font-semibold">{etiqueta}</label>
          <div className={secreto ? 'login-password-wrapper' : ''}>
            <Input id={`registro-${campo}`} name={campo} type={secreto ? (visible ? 'text' : 'password') : campo === 'email' ? 'email' : 'text'}
              value={datos[campo]} onChange={(e) => setDatos((actual) => ({ ...actual, [campo]: e.target.value }))}
              autoComplete={autocomplete} required disabled={enviando} maxLength={campo === 'nombreCompleto' || campo === 'email' ? 120 : 72}
              aria-invalid={!!errores[campo]} aria-describedby={`${campo === 'password' ? 'registro-password-ayuda ' : ''}${errores[campo] ? `registro-${campo}-error` : ''}`.trim() || undefined}
              className={`login-input ${secreto ? 'login-password-input' : ''}`} />
            {secreto && <button type="button" className="login-password-toggle" disabled={enviando}
              aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${campo === 'password' ? 'contraseña' : 'confirmación'}`} aria-pressed={visible}
              onClick={() => setVisibles((v) => ({ ...v, [campo]: !v[campo] }))}>
              {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>}
          </div>
          {campo === 'password' && <p id="registro-password-ayuda" className="mt-1 text-xs text-slate-500">{REGLA_PASSWORD}</p>}
          {errores[campo] && <p id={`registro-${campo}-error`} className="mt-1 text-xs text-rose-700" role="alert">{errores[campo]}</p>}
        </div>;
      })}
      <Button type="submit" variante="primario" className="login-submit" cargando={enviando}>{enviando ? 'Enviando solicitud…' : 'Crear cuenta'}</Button>
      <p className="text-xs text-slate-500">El acceso requiere activación del laboratorio. No podrá entrar mientras su cuenta esté inactiva.</p>
    </form>}
    <p className="mt-5 text-center"><Link className="auth-link" to="/login">Volver a iniciar sesión</Link></p>
  </>;
}
