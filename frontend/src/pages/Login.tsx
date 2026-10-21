import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert } from '../components/UI/Alert';
import { Button } from '../components/UI/Button';
import { Campo, Input } from '../components/UI/Form';
import { useAuth } from '../context/AuthContext';
import { mensajeDeError } from '../services/api';

const ETAPAS = [
  'Admisión del paciente y solicitud médica',
  'Recepción de la muestra con código de barras',
  'Procesamiento y carga de hallazgos',
  'Validación formal con doble firma',
];

export default function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destino = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (usuario) {
    return <Navigate to={destino} replace />;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(username.trim(), password);
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full">
      <section className="flex w-[34rem] shrink-0 flex-col justify-between bg-violeta-950 px-12 py-14 text-violeta-100">
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-9 text-white">Laboratorio Bacteriológico</h1>
          <p className="mt-2 text-base text-violeta-300">Sistema de gestión de muestras y resultados</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-violeta-200">Recorrido de una muestra</p>
          <ol className="space-y-3 border-l border-violeta-700 pl-5">
            {ETAPAS.map((etapa) => (
              <li key={etapa} className="relative text-sm">
                <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-violeta-300" aria-hidden />
                {etapa}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-lamina">
        <form onSubmit={enviar} className="w-80 space-y-4" noValidate>
          <div>
            <h2 className="font-serif text-xl font-semibold text-violeta-900">Iniciar sesión</h2>
            <p className="text-sm text-slate-600">Ingrese con su usuario del laboratorio.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Campo etiqueta="Usuario">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Campo>
          <Button type="submit" variante="primario" className="w-full" disabled={!username.trim() || !password} cargando={enviando}>
            {enviando ? 'Verificando' : 'Iniciar sesión'}
          </Button>
        </form>
      </section>
    </div>
  );
}

export function PantallaCarga() {
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
      Cargando sesión
    </div>
  );
}
