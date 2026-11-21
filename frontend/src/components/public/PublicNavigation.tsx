import { useEffect, useState, type RefObject } from 'react';

type Seccion = 'inicio' | 'conoce' | 'funciones';

/** Animación progresiva y navegación del v5, con limpieza al abandonar la ruta pública. */
export function usePublicExperience(pagina: RefObject<HTMLElement>, registro: boolean, disponible = true) {
  const [progreso, setProgreso] = useState(0);
  const [seccion, setSeccion] = useState<Seccion>('inicio');

  useEffect(() => {
    const raiz = pagina.current;
    if (!raiz || !disponible) return;
    const tituloAnterior = document.title;
    document.title = `${registro ? 'Registro' : 'Acceso'} · LabZen`;
    let frame: number | undefined;
    const actualizar = () => {
      const maximo = document.documentElement.scrollHeight - window.innerHeight;
      setProgreso(maximo > 0 ? Math.min(100, Math.max(0, window.scrollY / maximo * 100)) : 0);
      const funciones = raiz.querySelector<HTMLElement>('#funciones');
      const conoce = raiz.querySelector<HTMLElement>('#conoce');
      setSeccion(funciones && window.scrollY >= funciones.offsetTop - 160 ? 'funciones'
        : conoce && window.scrollY >= conoce.offsetTop - 160 ? 'conoce' : 'inicio');
      frame = undefined;
    };
    const alDesplazar = () => {
      if (frame === undefined) frame = requestAnimationFrame(actualizar);
    };
    const reducida = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.movimiento === 'reducido';
    const elementos = raiz.querySelectorAll('.reveal');
    let observer: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window && !reducida) {
      raiz.classList.add('public-motion-ready');
      observer = new IntersectionObserver((entradas) => entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observer?.unobserve(entrada.target);
        }
      }), { threshold: 0.07 });
      elementos.forEach((elemento) => observer!.observe(elemento));
    } else elementos.forEach((elemento) => elemento.classList.add('visible'));

    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    actualizar();
    return () => {
      observer?.disconnect();
      raiz.classList.remove('public-motion-ready');
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
      if (frame !== undefined) cancelAnimationFrame(frame);
      document.title = tituloAnterior;
    };
  }, [pagina, registro, disponible]);

  return { progreso, seccion };
}

export function PublicNavigation({ progreso, seccion, registro }: { progreso: number; seccion: Seccion; registro: boolean }) {
  return <>
    <a className="public-skip-link" href={registro ? '#registro-nombreCompleto' : '#usuario'}>Ir al formulario de acceso</a>
    <div className="scroll-progress" aria-hidden><div style={{ width: `${progreso}%` }} /></div>
    <nav className="topnav" aria-label="Secciones públicas de LabZen">
      {([['inicio', 'Inicio'], ['conoce', 'Conoce LabZen'], ['funciones', 'Funciones']] as const).map(([id, nombre]) => (
        <a key={id} href={`#${id}`} aria-current={seccion === id ? 'location' : undefined}>{nombre}</a>
      ))}
    </nav>
  </>;
}
