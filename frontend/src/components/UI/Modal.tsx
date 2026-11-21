
import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useInternalUI } from '../../context/InternalUIContext';

interface ModalProps {
  abierto: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  ancho?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  pie?: ReactNode;
  variante?: 'dialogo' | 'lateral';
}

const ANCHO = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
} as const;

interface DialogoActivo {
  capa: HTMLDivElement;
  dialogo: HTMLDivElement;
  ultimoFoco: HTMLElement;
}

const pila: DialogoActivo[] = [];
const fondoInerte = new Map<HTMLElement, string | null>();
const regionesAvisos = new Set<HTMLElement>();
let overflowOriginal = '';

/** Solo registra el contenedor de avisos, nunca controles de la aplicación. */
export function registrarRegionAvisos(region: HTMLElement) {
  regionesAvisos.add(region);
  actualizarFondo();
  return () => {
    regionesAvisos.delete(region);
    region.remove();
  };
}

function modalSuperior() {
  return pila[pila.length - 1];
}

/** Los portales son hijos directos de body: solo la capa superior queda activa. */
function actualizarFondo() {
  fondoInerte.forEach((valor, elemento) => {
    if (valor === null) elemento.removeAttribute('inert');
    else elemento.setAttribute('inert', valor);
  });
  fondoInerte.clear();

  const superior = modalSuperior();
  // El host no lo administra React: puede moverse sin desmontar el portal ni
  // perder los avisos, incluso si se acaba de retirar la capa superior del DOM.
  const destinoAvisos = superior?.dialogo ?? document.body;
  regionesAvisos.forEach((region) => {
    if (region.parentElement !== destinoAvisos) destinoAvisos.append(region);
  });
  if (!superior) return;

  for (const elemento of document.body.children) {
    if (elemento instanceof HTMLElement && elemento !== superior.capa) {
      fondoInerte.set(elemento, elemento.getAttribute('inert'));
      elemento.setAttribute('inert', '');
    }
  }
}

function disponible(elemento: HTMLElement): boolean {
  if (!elemento.isConnected || elemento.matches(':disabled, input[type="hidden"]')) return false;
  for (let actual: HTMLElement | null = elemento; actual; actual = actual.parentElement) {
    const estilo = getComputedStyle(actual);
    if (actual.hidden || actual.hasAttribute('inert') || estilo.display === 'none' ||
        estilo.visibility === 'hidden' || estilo.visibility === 'collapse') return false;
  }
  return true;
}

function enfocables(dialogo: HTMLElement): HTMLElement[] {
  return Array.from(dialogo.querySelectorAll<HTMLElement>(
    'a[href], area[href], button, input, select, textarea, iframe, summary, ' +
    'audio[controls], video[controls], [contenteditable], [tabindex]',
  ))
    .filter((elemento) => elemento.tabIndex >= 0 && disponible(elemento))
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}

function recuperarFoco(modal: DialogoActivo) {
  const destino = disponible(modal.ultimoFoco) ? modal.ultimoFoco : modal.dialogo;
  destino.focus({ preventScroll: true });
}

export function Modal({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  ancho = 'lg',
  children,
  pie,
  variante = 'dialogo',
}: ModalProps) {
  const interno = useInternalUI();
  const idTitulo = useId();
  const idModal = useId();
  const capa = useRef<HTMLDivElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const focoAlAbrir = useRef<HTMLElement | null>(null);
  const focoInicial = useRef<HTMLElement | null>(null);
  const estabaAbierto = useRef(false);

  // Se captura antes del commit: React puede aplicar autoFocus a un hijo antes
  // del efecto del modal, y ese campo no debe reemplazar al control de apertura.
  if (abierto && !estabaAbierto.current) {
    focoAlAbrir.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focoInicial.current = null;
  }
  estabaAbierto.current = abierto;

  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useLayoutEffect(() => {
    if (!abierto || !contenedor.current || !capa.current) return;

    const dialogo = contenedor.current;
    const origen = focoAlAbrir.current;
    const activo = document.activeElement;
    // Conserva autoFocus también cuando StrictMode repite montaje y limpieza.
    if (activo instanceof HTMLElement && dialogo.contains(activo)) focoInicial.current = activo;
    const modal: DialogoActivo = {
      capa: capa.current,
      dialogo,
      ultimoFoco: focoInicial.current && dialogo.contains(focoInicial.current) ? focoInicial.current : dialogo,
    };

    if (pila.length === 0) overflowOriginal = document.body.style.overflow;
    pila.push(modal);
    document.body.style.overflow = 'hidden';
    actualizarFondo();
    recuperarFoco(modal);

    // También aísla elementos que se añadan a body mientras el diálogo está abierto.
    const observador = new MutationObserver(() => {
      if (modalSuperior() === modal) actualizarFondo();
    });
    observador.observe(document.body, { childList: true });

    const alPresionar = (evento: KeyboardEvent) => {
      if (modalSuperior() !== modal || evento.defaultPrevented || evento.isComposing) return;

      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        cerrar.current();
      } else if (evento.key === 'Tab') {
        const elementos = enfocables(dialogo);
        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        const foco = document.activeElement;

        if (!primero || !ultimo) {
          evento.preventDefault();
          dialogo.focus({ preventScroll: true });
        } else if (!elementos.includes(foco as HTMLElement) ||
          (evento.shiftKey ? foco === primero : foco === ultimo)) {
          evento.preventDefault();
          (evento.shiftKey ? ultimo : primero).focus({ preventScroll: true });
        }
      }
    };

    const alEnfocar = (evento: FocusEvent) => {
      if (modalSuperior() !== modal || !(evento.target instanceof HTMLElement)) return;
      if (dialogo.contains(evento.target)) {
        modal.ultimoFoco = evento.target;
      } else {
        // Permite autoFocus durante el montaje de otro portal, antes de que su
        // efecto lo registre como superior. El fondo normal permanece inerte.
        const nuevaCapa = evento.target.closest('[data-modal-layer]');
        if (nuevaCapa && !pila.some((entrada) => entrada.capa === nuevaCapa)) return;
        recuperarFoco(modal);
      }
    };

    window.addEventListener('keydown', alPresionar);
    document.addEventListener('focusin', alEnfocar);

    return () => {
      observador.disconnect();
      window.removeEventListener('keydown', alPresionar);
      document.removeEventListener('focusin', alEnfocar);

      const eraSuperior = modalSuperior() === modal;
      const posicion = pila.indexOf(modal);
      if (posicion >= 0) pila.splice(posicion, 1);

      actualizarFondo();
      if (pila.length === 0) document.body.style.overflow = overflowOriginal;

      if (eraSuperior) {
        const anterior = modalSuperior();
        if (origen && disponible(origen) && (!anterior || anterior.dialogo.contains(origen))) {
          origen.focus({ preventScroll: true });
        } else if (anterior) {
          recuperarFoco(anterior);
        }
      }
    };
  }, [abierto, idModal]);

  if (!abierto) return null;

  return createPortal(
    <div ref={capa} data-modal-layer={idModal} className={`${interno ? 'labzen-internal lz-modal-layer ' : ''}${variante === 'lateral' ? 'lz-drawer-layer ' : ''}fixed inset-0 z-50 flex animate-aparecer items-start justify-center overflow-y-auto bg-[#241833]/55 px-4 py-6 backdrop-blur-[2px] sm:px-6 sm:py-8`}>

      <div
        className="fixed inset-0"
        onClick={() => onCerrar()}
        aria-hidden
      />

      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`${variante === 'lateral' ? 'lz-drawer ' : ''}relative flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl outline-none sm:max-h-[calc(100vh-4rem)] ${ANCHO[ancho]}`}
      >

        {/* Encabezado */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">

          <div className="min-w-0">
            <h2
              id={idTitulo}
              className="font-serif text-2xl font-semibold leading-tight tracking-tight text-heading"
            >
              {titulo}
            </h2>

            {subtitulo && (
              <div className="mt-1.5 text-sm text-muted">
                {subtitulo}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onCerrar()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-accent-soft hover:text-accent"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenido */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-6 py-4">
          {children}
        </div>

        {/* Acciones */}
        {pie && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line bg-subtle px-6 py-4">
            {pie}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
