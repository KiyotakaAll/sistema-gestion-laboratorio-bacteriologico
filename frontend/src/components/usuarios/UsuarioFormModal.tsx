import { useRef, useState, type FormEvent } from 'react';
import { usuariosApi } from '../../services/laboratorio';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import type { NuevoUsuarioAdministrativo, PerfilOperativo, UsuarioAdministracion } from '../../types/api';
import { REGLA_PASSWORD, validarRegistro } from '../../utils/registro';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input, Select } from '../UI/Form';
import { Modal } from '../UI/Modal';

export function UsuarioFormModal({ roles, onCerrar, onCreado }: {
  roles: PerfilOperativo[]; onCerrar: () => void; onCreado: (usuario: UsuarioAdministracion) => void;
}) {
  const [datos, setDatos] = useState<NuevoUsuarioAdministrativo>({
    nombreCompleto: '', username: '', email: '', password: '', confirmacion: '',
    rol: roles.includes('BACTERIOLOGO') ? 'BACTERIOLOGO' : 'AUXILIAR',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);
  const [visibles, setVisibles] = useState({ password: false, confirmacion: false });
  const bloqueo = useRef(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (bloqueo.current) return;
    const errores: Partial<Record<keyof NuevoUsuarioAdministrativo, string>> = validarRegistro(datos);
    if (!/^[a-z0-9][a-z0-9_.-]{2,39}$/i.test(datos.username.trim()))
      errores.username = 'Use entre 3 y 40 caracteres: letras sin acentos, números, punto, guion o guion bajo.';
    if (!roles.includes(datos.rol) || !['AUXILIAR', 'BACTERIOLOGO'].includes(datos.rol))
      errores.rol = 'Seleccione un perfil disponible.';
    setError(null);
    setDetalles(Object.entries(errores).map(([campo, mensaje]) => ({ campo, mensaje })));
    if (Object.keys(errores).length) { setError('Revise los datos del formulario.'); return; }
    bloqueo.current = true; setGuardando(true);
    try {
      const usuario = await usuariosApi.crear({ ...datos,
        nombreCompleto: datos.nombreCompleto.trim(), username: datos.username.trim().toLowerCase(), email: datos.email.trim().toLowerCase(),
      });
      setDatos(prev => ({ ...prev, password: '', confirmacion: '' }));
      setVisibles({ password: false, confirmacion: false });
      onCreado(usuario);
    } catch (err) {
      setError(mensajeDeError(err)); setDetalles(detallesDeError(err));
    } finally { bloqueo.current = false; setGuardando(false); }
  }

  return <Modal abierto titulo="Crear usuario" ancho="md" onCerrar={() => { if (!bloqueo.current) onCerrar(); }}>
    <form onSubmit={enviar} noValidate className="space-y-4" aria-busy={guardando}>
      <Alert tipo="info">La cuenta se creará inactiva. Verifique la identidad y actívela desde la lista para permitir el acceso.</Alert>
      {error && <Alert detalles={detalles}>{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([
          ['nombreCompleto', 'Nombre completo', 'text', 120, 'name'],
          ['username', 'Nombre de usuario', 'text', 40, 'off'],
          ['email', 'Correo electrónico', 'email', 120, 'off'],
          ['password', 'Contraseña inicial', 'password', undefined, 'new-password'],
          ['confirmacion', 'Confirmar contraseña', 'password', undefined, 'new-password'],
        ] as const).map(([campo, etiqueta, tipo, max, autoComplete]) => {
          const secreto = campo === 'password' || campo === 'confirmacion';
          const visible = secreto && visibles[campo];
          return (
          <Campo key={campo} etiqueta={etiqueta} ayuda={campo === 'password' ? REGLA_PASSWORD : campo === 'username' ? 'De 3 a 40 caracteres, sin espacios ni @.' : undefined}>
            <Input type={secreto && visible ? 'text' : tipo} autoComplete={autoComplete} required maxLength={secreto ? undefined : max} value={datos[campo]} disabled={guardando}
              aria-invalid={detalles.some(d => d.campo === campo)}
              onChange={e => setDatos(prev => ({ ...prev, [campo]: e.target.value }))} />
            {secreto && <Button tamano="sm" variante="fantasma" disabled={guardando}
              aria-pressed={visible} onClick={() => setVisibles(prev => ({ ...prev, [campo]: !prev[campo] }))}>
              {visible ? 'Ocultar' : 'Mostrar'} {campo === 'password' ? 'contraseña inicial' : 'confirmación'}
            </Button>}
          </Campo>);
        })}
        <Campo etiqueta="Perfil operativo" ayuda={!roles.includes('AUXILIAR') ? 'El perfil auxiliar aún no está disponible.' : undefined}>
          <Select value={datos.rol} disabled={guardando} onValueChange={value => {
            if ((value === 'AUXILIAR' || value === 'BACTERIOLOGO') && roles.includes(value)) setDatos(prev => ({ ...prev, rol: value }));
          }}>
            <option value="AUXILIAR" disabled={!roles.includes('AUXILIAR')}>Auxiliar</option>
            <option value="BACTERIOLOGO" disabled={!roles.includes('BACTERIOLOGO')}>Bacteriólogo</option>
          </Select>
        </Campo>
      </div>
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" variante="primario" cargando={guardando}>Crear usuario</Button>
      </div>
    </form>
  </Modal>;
}
