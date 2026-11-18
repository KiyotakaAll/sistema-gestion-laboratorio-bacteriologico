import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/UI/Modal';
import { ToastProvider, useToast } from '../context/ToastContext';

function Escenario({ autoFocus = false, quitarOrigen = false }: {
  autoFocus?: boolean;
  quitarOrigen?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {(!quitarOrigen || !abierto) && <button onClick={() => setAbierto(true)}>Abrir diálogo</button>}
      <button>Acción del fondo</button>
      <Modal abierto={abierto} titulo="Prueba de foco" onCerrar={() => setAbierto(false)}>
        <input aria-label="Nombre" autoFocus={autoFocus} />
        <button disabled>No disponible</button>
        <fieldset disabled><button>Deshabilitado por fieldset</button></fieldset>
        <div hidden><button>Oculto</button></div>
        <div style={{ display: 'none' }}><button>Oculto por estilo</button></div>
        <button onClick={() => setAbierto(false)}>Terminar</button>
      </Modal>
    </>
  );
}

function Superpuestos({ autoFocus = false }: { autoFocus?: boolean }) {
  const [detalle, setDetalle] = useState(false);
  const [edicion, setEdicion] = useState(false);
  return (
    <>
      <button onClick={() => setDetalle(true)}>Abrir paciente</button>
      <Modal abierto={detalle} titulo="Detalle del paciente" onCerrar={() => setDetalle(false)}>
        <button onClick={() => setEdicion(true)}>Editar datos</button>
        <button onClick={() => setDetalle(false)}>Retirar detalle</button>
      </Modal>
      <Modal abierto={edicion} titulo="Editar paciente" onCerrar={() => setEdicion(false)}>
        <input aria-label="Apellidos" autoFocus={autoFocus} />
        <button onClick={() => setDetalle(false)}>Retirar modal inferior</button>
        <button onClick={() => setEdicion(false)}>Cancelar edición</button>
      </Modal>
    </>
  );
}

function vigilarListeners() {
  const agregarVentana = vi.spyOn(window, 'addEventListener');
  const quitarVentana = vi.spyOn(window, 'removeEventListener');
  const agregarDocumento = vi.spyOn(document, 'addEventListener');
  const quitarDocumento = vi.spyOn(document, 'removeEventListener');
  return {
    comprobarLimpieza(minimo = 2) {
      const teclas = agregarVentana.mock.calls.filter(([tipo]) => tipo === 'keydown');
      const focos = agregarDocumento.mock.calls.filter(([tipo]) => tipo === 'focusin');
      // Al montar abierto, StrictMode debe ejecutar y limpiar el efecto activo.
      expect(teclas.length).toBeGreaterThanOrEqual(minimo);
      expect(focos.length).toBeGreaterThanOrEqual(minimo);
      for (const [tipo, listener] of teclas) {
        expect(quitarVentana).toHaveBeenCalledWith(tipo, listener);
      }
      for (const [tipo, listener] of focos) {
        expect(quitarDocumento).toHaveBeenCalledWith(tipo, listener);
      }
    },
    restaurar() {
      agregarVentana.mockRestore();
      quitarVentana.mockRestore();
      agregarDocumento.mockRestore();
      quitarDocumento.mockRestore();
    },
  };
}

describe('Modal: foco y teclado', () => {
  it('enfoca el diálogo al abrir y restaura el origen al cerrar con Escape', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<Escenario />);
    const origen = screen.getByRole('button', { name: 'Abrir diálogo' });
    await usuario.click(origen);

    expect(screen.getByRole('dialog', { name: 'Prueba de foco' })).toHaveFocus();
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(origen).toHaveFocus();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('respeta autoFocus y recupera el control de apertura, incluso en StrictMode', async () => {
    const usuario = userEvent.setup();
    render(<StrictMode><Escenario autoFocus /></StrictMode>);
    const origen = screen.getByRole('button', { name: 'Abrir diálogo' });
    await usuario.click(origen);
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveFocus();
    await usuario.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(origen).toHaveFocus();

    await usuario.click(origen);
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(origen).toHaveFocus();
  });

  it('recorre controles disponibles y cierra el ciclo con Tab y Shift+Tab', async () => {
    const usuario = userEvent.setup();
    render(<Escenario />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    const nombre = screen.getByRole('textbox', { name: 'Nombre' });
    const terminar = screen.getByRole('button', { name: 'Terminar' });

    await usuario.tab();
    expect(cerrar).toHaveFocus();
    await usuario.tab();
    expect(nombre).toHaveFocus();
    await usuario.tab();
    expect(terminar).toHaveFocus();
    await usuario.tab();
    expect(cerrar).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(terminar).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(nombre).toHaveFocus();
  });

  it('Shift+Tab desde el contenedor lleva al último control', async () => {
    const usuario = userEvent.setup();
    render(<Escenario />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Terminar' })).toHaveFocus();
  });

  it('recalcula los controles cuando cambia el formulario', async () => {
    const usuario = userEvent.setup();
    function Formulario() {
      const [extra, setExtra] = useState(false);
      return <Modal abierto titulo="Dinámico" onCerrar={vi.fn()}>
        <button onClick={() => setExtra(true)}>Agregar campo</button>
        {extra && <input aria-label="Nuevo campo" />}
      </Modal>;
    }
    render(<Formulario />);
    await usuario.click(screen.getByRole('button', { name: 'Agregar campo' }));
    await usuario.tab();
    expect(screen.getByRole('textbox', { name: 'Nuevo campo' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('impide desviar el foco al fondo y aísla nuevos elementos de body', async () => {
    const usuario = userEvent.setup();
    render(<Escenario autoFocus />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    const nombre = screen.getByRole('textbox', { name: 'Nombre' });
    // JSDOM no implementa inert: el guardián de focusin también debe protegerlo.
    screen.getByRole('button', { name: 'Acción del fondo' }).focus();
    expect(nombre).toHaveFocus();

    const externo = document.createElement('button');
    document.body.append(externo);
    try {
      await waitFor(() => expect(externo).toHaveAttribute('inert'));
      externo.focus();
      expect(nombre).toHaveFocus();
      await usuario.keyboard('{Escape}');
      expect(externo).not.toHaveAttribute('inert');
    } finally {
      externo.remove();
    }
  });

  it('no intenta devolver el foco a un origen que se retiró del DOM', async () => {
    const usuario = userEvent.setup();
    render(<Escenario quitarOrigen />);
    const origen = screen.getByRole('button', { name: 'Abrir diálogo' });
    await usuario.click(origen);
    expect(origen).not.toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(origen);
  });

  it('respeta Escape consumido por un control y permite que onCerrar decida el cierre', async () => {
    const usuario = userEvent.setup();
    const cerrar = vi.fn();
    render(<Modal abierto titulo="Restricciones" onCerrar={cerrar}>
      <input aria-label="Selector" onKeyDown={(evento) => {
        if (evento.key === 'Escape') evento.preventDefault();
      }} />
    </Modal>);
    await usuario.click(screen.getByRole('textbox', { name: 'Selector' }));
    await usuario.keyboard('{Escape}');
    expect(cerrar).not.toHaveBeenCalled();

    screen.getByRole('dialog').focus();
    await usuario.keyboard('{Escape}');
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('cancela Tab y Shift+Tab si todos los controles quedan deshabilitados', async () => {
    const usuario = userEvent.setup();
    render(<Modal abierto titulo="Sin controles" onCerrar={vi.fn()}><p>Contenido</p></Modal>);
    const dialogo = screen.getByRole('dialog');
    within(dialogo).getByRole('button', { name: 'Cerrar' }).setAttribute('disabled', '');
    for (const shiftKey of [false, true]) {
      const evento = createEvent.keyDown(dialogo, { key: 'Tab', shiftKey, cancelable: true });
      fireEvent(dialogo, evento);
      expect(evento.defaultPrevented).toBe(true);
      expect(dialogo).toHaveFocus();
      await usuario.tab({ shift: shiftKey });
      expect(dialogo).toHaveFocus();
    }
  });

  it('restaura el estado previo del fondo y del scroll al desmontar', async () => {
    const usuario = userEvent.setup();
    const anterior = document.body.style.overflow;
    const externo = document.createElement('div');
    externo.setAttribute('inert', 'preexistente');
    document.body.append(externo);
    document.body.style.overflow = 'scroll';
    const { unmount, container } = render(<StrictMode><Escenario /></StrictMode>);
    try {
      await usuario.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
      unmount();
      expect(container).not.toHaveAttribute('inert');
      expect(externo).toHaveAttribute('inert', 'preexistente');
      expect(document.body.style.overflow).toBe('scroll');
    } finally {
      unmount();
      externo.remove();
      document.body.style.overflow = anterior;
    }
  });
});

describe('Modal: diálogos superpuestos', () => {
  it.each([false, true])('solo el superior controla foco y Escape (autoFocus=%s)', async (autoFocus) => {
    const usuario = userEvent.setup();
    const { container } = render(<StrictMode><Superpuestos autoFocus={autoFocus} /></StrictMode>);
    const origen = screen.getByRole('button', { name: 'Abrir paciente' });
    await usuario.click(origen);
    const detalle = screen.getByRole('dialog', { name: 'Detalle del paciente' });
    const editar = within(detalle).getByRole('button', { name: 'Editar datos' });
    await usuario.click(editar);
    const edicion = screen.getByRole('dialog', { name: 'Editar paciente' });
    const capaDetalle = detalle.closest('[data-modal-layer]');
    expect(capaDetalle).toHaveAttribute('inert');
    expect(edicion.closest('[data-modal-layer]')).not.toHaveAttribute('inert');
    expect(autoFocus ? within(edicion).getByRole('textbox') : edicion).toHaveFocus();

    editar.focus();
    expect(edicion).toContainElement(document.activeElement as HTMLElement);
    const cancelar = within(edicion).getByRole('button', { name: 'Cancelar edición' });
    cancelar.focus();
    await usuario.tab();
    expect(within(edicion).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(cancelar).toHaveFocus();
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Editar paciente' })).not.toBeInTheDocument();
    expect(detalle).toBeInTheDocument();
    expect(capaDetalle).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
    expect(editar).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await usuario.tab({ shift: true });
    expect(within(detalle).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(origen).toHaveFocus();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('mantiene el modal superior activo si el inferior se desmonta primero', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<Superpuestos />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir paciente' }));
    await usuario.click(screen.getByRole('button', { name: 'Editar datos' }));
    await usuario.click(screen.getByRole('button', { name: 'Retirar modal inferior' }));
    const edicion = screen.getByRole('dialog', { name: 'Editar paciente' });
    expect(screen.queryByRole('dialog', { name: 'Detalle del paciente' })).not.toBeInTheDocument();
    expect(edicion).toContainElement(document.activeElement as HTMLElement);
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal: montaje inicialmente abierto en StrictMode', () => {
  it.each([false, true])('enfoca y limpia un diálogo inicialmente abierto (autoFocus=%s)', async (autoFocus) => {
    const usuario = userEvent.setup();
    const origen = document.createElement('button');
    document.body.append(origen);
    origen.focus();
    const cerrar = vi.fn();
    const listeners = vigilarListeners();
    const { unmount, container } = render(<StrictMode>
      <Modal abierto titulo="Inicialmente abierto" onCerrar={cerrar}>
        <input aria-label="Campo inicial" autoFocus={autoFocus} />
      </Modal>
    </StrictMode>);
    try {
      const dialogo = screen.getByRole('dialog', { name: 'Inicialmente abierto' });
      expect(autoFocus ? within(dialogo).getByRole('textbox') : dialogo).toHaveFocus();
      expect(container).toHaveAttribute('inert');
      await usuario.keyboard('{Escape}');
      expect(cerrar).toHaveBeenCalledTimes(1);
      unmount();
      expect(origen).toHaveFocus();
      expect(document.querySelector('[inert]')).toBeNull();
      expect(document.body.style.overflow).toBe('');
      listeners.comprobarLimpieza();
      const escape = createEvent.keyDown(window, { key: 'Escape', cancelable: true });
      fireEvent(window, escape);
      expect(escape.defaultPrevented).toBe(false);
      expect(cerrar).toHaveBeenCalledTimes(1);
      container.tabIndex = 0;
      container.focus();
      expect(container).toHaveFocus();
    } finally {
      unmount();
      origen.remove();
      listeners.restaurar();
    }
  });

  it.each([false, true])('recupera el diálogo anterior y limpia dos abiertos al montar (autoFocus=%s)', async (autoFocus) => {
    const usuario = userEvent.setup();
    const origen = document.createElement('button');
    document.body.append(origen);
    origen.focus();
    const cerrarPrincipal = vi.fn();
    const cerrarSuperior = vi.fn();
    function InicialmenteSuperpuestos() {
      const [principal, setPrincipal] = useState(true);
      const [superior, setSuperior] = useState(true);
      return <>
        {principal && <Modal abierto titulo="Principal inicial" onCerrar={() => {
          cerrarPrincipal();
          setPrincipal(false);
        }}><button>Control principal</button></Modal>}
        {superior && <Modal abierto titulo="Superior inicial" onCerrar={() => {
          cerrarSuperior();
          setSuperior(false);
        }}><input aria-label="Campo superior" autoFocus={autoFocus} /></Modal>}
      </>;
    }
    const listeners = vigilarListeners();
    const { unmount, container } = render(<StrictMode><InicialmenteSuperpuestos /></StrictMode>);
    try {
      const principal = screen.getByRole('dialog', { name: 'Principal inicial' });
      const superior = screen.getByRole('dialog', { name: 'Superior inicial' });
      expect(autoFocus ? within(superior).getByRole('textbox') : superior).toHaveFocus();
      expect(principal.closest('[data-modal-layer]')).toHaveAttribute('inert');
      expect(superior.closest('[data-modal-layer]')).not.toHaveAttribute('inert');
      await usuario.keyboard('{Escape}');
      expect(cerrarSuperior).toHaveBeenCalledTimes(1);
      expect(cerrarPrincipal).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: 'Superior inicial' })).toBeNull();
      // Se montaron juntos: no hubo control de apertura en el principal.
      expect(principal).toHaveFocus();
      expect(principal.closest('[data-modal-layer]')).not.toHaveAttribute('inert');
      expect(container).toHaveAttribute('inert');
      await usuario.keyboard('{Escape}');
      expect(cerrarPrincipal).toHaveBeenCalledTimes(1);
      expect(origen).toHaveFocus();
      expect(document.querySelector('[inert]')).toBeNull();
      expect(document.body.style.overflow).toBe('');
      unmount();
      listeners.comprobarLimpieza(4);
      const tab = createEvent.keyDown(origen, { key: 'Tab', cancelable: true });
      fireEvent(origen, tab);
      expect(tab.defaultPrevented).toBe(false);
      origen.focus();
      expect(origen).toHaveFocus();
    } finally {
      unmount();
      origen.remove();
      listeners.restaurar();
    }
  });
});

describe('Modal y ToastContext', () => {
  it('retira el host de avisos al desmontar el proveedor con un diálogo activo', async () => {
    const usuario = userEvent.setup();
    function Aviso() {
      const toast = useToast();
      return <button onClick={() => toast.info('Aviso antes de desmontar')}>Notificar</button>;
    }
    const { unmount } = render(<StrictMode><ToastProvider>
      <Modal abierto titulo="Desmontaje" onCerrar={vi.fn()}><Aviso /></Modal>
    </ToastProvider></StrictMode>);
    await usuario.click(screen.getByRole('button', { name: 'Notificar' }));
    const region = screen.getByRole('status');
    expect(region.closest('[inert]')).toBeNull();
    unmount();
    expect(region).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    // Una referencia obsoleta en el registro no debe volver a insertar el host.
    render(<Modal abierto titulo="Otro diálogo" onCerrar={vi.fn()}><p>Contenido</p></Modal>);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('mantiene los avisos en el diálogo activo sin habilitar el fondo, también al cerrar uno superpuesto', async () => {
    const usuario = userEvent.setup();
    function AvisosEnModales() {
      const toast = useToast();
      const [principal, setPrincipal] = useState(true);
      const [superior, setSuperior] = useState(false);
      return <>
        <button>Control del fondo</button>
        {principal && <Modal abierto titulo="Avisos principal" onCerrar={() => setPrincipal(false)}>
          <button onClick={() => toast.exito('Aviso del principal')}>Notificar principal</button>
          <button onClick={() => setSuperior(true)}>Abrir superior</button>
        </Modal>}
        {superior && <Modal abierto titulo="Avisos superior" onCerrar={() => setSuperior(false)}>
          <button onClick={() => toast.info('Aviso del superior')}>Notificar superior</button>
        </Modal>}
      </>;
    }
    const { container, unmount } = render(<StrictMode><ToastProvider><AvisosEnModales /></ToastProvider></StrictMode>);
    const principal = screen.getByRole('dialog', { name: 'Avisos principal' });
    const region = screen.getByRole('status');
    expect(region.closest('[inert]')).toBeNull();
    expect(principal).toContainElement(region);
    expect(container).toHaveAttribute('inert');
    await usuario.click(screen.getByRole('button', { name: 'Notificar principal' }));
    expect(region).toHaveTextContent('Aviso del principal');
    await usuario.click(screen.getByRole('button', { name: 'Abrir superior' }));
    const superior = screen.getByRole('dialog', { name: 'Avisos superior' });
    expect(superior).toContainElement(region);
    expect(region.closest('[inert]')).toBeNull();
    expect(principal.closest('[data-modal-layer]')).toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
    await usuario.click(screen.getByRole('button', { name: 'Notificar superior' }));
    expect(region).toHaveTextContent('Aviso del superior');
    expect(screen.getByRole('status')).toBe(region);
    const foco = document.activeElement;
    screen.getByRole('button', { name: 'Control del fondo' }).focus();
    expect(foco).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(principal).toContainElement(region);
    expect(region.closest('[inert]')).toBeNull();
    expect(container).toHaveAttribute('inert');
    await usuario.keyboard('{Escape}');
    expect(document.body).toContainElement(region);
    expect(region.closest('[inert]')).toBeNull();
    expect(container).not.toHaveAttribute('inert');
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    expect(region).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
  });
});
