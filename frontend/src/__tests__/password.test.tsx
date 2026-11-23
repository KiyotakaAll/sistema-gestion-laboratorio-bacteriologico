import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { UsuarioFormModal } from '../components/usuarios/UsuarioFormModal';
import { RegistroForm } from '../components/RegistroForm';
import { authApi, usuariosApi } from '../services/laboratorio';
import { REGLA_PASSWORD } from '../utils/registro';

vi.mock('../services/laboratorio', () => ({ usuariosApi: { crear: vi.fn() }, authApi: { registrar: vi.fn() } }));
const usuario = { id:42,nombreCompleto:'Persona Nueva',username:'persona.nueva',email:'persona@example.test',
  activo:false,rol:'BACTERIOLOGO' as const,createdAt:'2026-11-23T12:00:00.000Z' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usuariosApi.crear).mockResolvedValue(usuario);
  vi.mocked(authApi.registrar).mockResolvedValue({mensaje:'Cuenta pendiente de activación.'});
});
function abrirAlta(onCreado=vi.fn()) {
  render(<UsuarioFormModal roles={['BACTERIOLOGO']} onCerrar={vi.fn()} onCreado={onCreado} />);
  for (const [etiqueta,valor] of [['Nombre completo',usuario.nombreCompleto],['Nombre de usuario',usuario.username],['Correo electrónico',usuario.email]] as const)
    fireEvent.change(screen.getByLabelText(etiqueta),{target:{value:valor}});
}
function password(valor: string, etiqueta='Contraseña inicial') {
  fireEvent.change(screen.getByLabelText(etiqueta,{exact:true}),{target:{value:valor}});
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'),{target:{value:valor}});
}
for (const [caso,valor] of [['ocho caracteres','calmaluz'],['sin símbolos ni minúsculas','CASCADAS'],
  ['frase con espacios','mi mesa tiene cuatro libros'],['Unicode','caféazul'],['emojis','🔬'.repeat(8)],
  ['espacios preservados','  mi café mira al mar  '],['72 bytes Unicode','á'.repeat(36)]] as const) {
  it(`alta administrativa permite ${caso} y transmite el secreto exacto`,async()=>{
    const onCreado=vi.fn();abrirAlta(onCreado);password(valor);
    expect(screen.getByText(REGLA_PASSWORD)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Crear usuario'}));
    await waitFor(()=>expect(usuariosApi.crear).toHaveBeenCalledExactlyOnceWith({nombreCompleto:usuario.nombreCompleto,
      username:usuario.username,email:usuario.email,password:valor,confirmacion:valor,rol:'BACTERIOLOGO'}));
    expect(onCreado).toHaveBeenCalledWith(usuario);
  });
}
for (const [caso,valor,mensaje] of [['corta','calmalu','Use al menos 8 caracteres'],
  ['común','12345678','demasiado común'],['común con espacios',' PASSWORD ','demasiado común'],
  ['larga ASCII','z'.repeat(73),'72 bytes UTF-8'],['larga Unicode','🔬'.repeat(19),'72 bytes UTF-8']] as const) {
  it(`alta administrativa explica contraseña ${caso} sin truncarla ni enviarla`,async()=>{
    abrirAlta();password(valor);const campo=screen.getByLabelText('Contraseña inicial');
    expect(campo).not.toHaveAttribute('maxlength');expect(campo).toHaveValue(valor);
    await userEvent.click(screen.getByRole('button',{name:'Crear usuario'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);expect(usuariosApi.crear).not.toHaveBeenCalled();
    expect(campo).toHaveValue(valor);expect(campo).toHaveAttribute('aria-invalid','true');
  });
}
it('alta permite mostrar y ocultar ambos campos sin cambiar su contenido',async()=>{
  abrirAlta();password('  mi patio azul  ');const u=userEvent.setup();
  for (const [etiqueta,nombre] of [['Contraseña inicial','contraseña inicial'],['Confirmar contraseña','confirmación']] as const) {
    const campo=screen.getByLabelText(etiqueta);
    await u.click(screen.getByRole('button',{name:`Mostrar ${nombre}`}));expect(campo).toHaveAttribute('type','text');
    expect(campo).toHaveValue('  mi patio azul  ');
    await u.click(screen.getByRole('button',{name:`Ocultar ${nombre}`}));expect(campo).toHaveAttribute('type','password');
  }
});
it('confirmación sigue siendo exacta y no permite omitir espacios del secreto',async()=>{
  abrirAlta();password('  mi patio azul  ');fireEvent.change(screen.getByLabelText('Confirmar contraseña'),{target:{value:'mi patio azul'}});
  await userEvent.click(screen.getByRole('button',{name:'Crear usuario'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');expect(usuariosApi.crear).not.toHaveBeenCalled();
});
function abrirRegistro(){render(<MemoryRouter><RegistroForm /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Nombre completo'),{target:{value:usuario.nombreCompleto}});
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:usuario.email}});
}
it('registro heredado muestra reglas nuevas y envía ocho caracteres sin campos privilegiados',async()=>{
  abrirRegistro();password('calmaluz','Contraseña');expect(screen.getByText(REGLA_PASSWORD)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Crear cuenta'}));
  await waitFor(()=>expect(authApi.registrar).toHaveBeenCalledExactlyOnceWith({nombreCompleto:usuario.nombreCompleto,email:usuario.email,password:'calmaluz',confirmacion:'calmaluz'}));
  expect(await screen.findByText('Cuenta pendiente de activación.')).toBeInTheDocument();
});
for(const [valor,mensaje] of [['1234567','Use al menos 8 caracteres'],['password','demasiado común'],['á'.repeat(37),'72 bytes UTF-8']] as const)
  it(`registro heredado explica el error: ${mensaje}`,async()=>{
    abrirRegistro();password(valor,'Contraseña');const campo=screen.getByLabelText('Contraseña',{exact:true});
    expect(campo).not.toHaveAttribute('maxlength');expect(campo).toHaveValue(valor);
    await userEvent.click(screen.getByRole('button',{name:'Crear cuenta'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);expect(authApi.registrar).not.toHaveBeenCalled();
    expect(campo).toHaveFocus();expect(campo).toHaveValue(valor);
  });
