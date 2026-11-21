import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { InternalUIContext } from '../context/InternalUIContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Modal } from './UI/Modal';

export const SIDEBAR_KEY = 'labzen_sidebar_collapsed_v1';
const CONSULTA_MOVIL = '(max-width: 767px)';

function preferenciaInicial() {
  try {
    const valor = localStorage.getItem(SIDEBAR_KEY);
    if (valor === 'true' || valor === 'false') return valor === 'true';
  } catch { /* La navegación sigue disponible sin almacenamiento. */ }
  return window.innerWidth < 1024;
}

export function LayoutDesktop() {
  const { key: rutaActual } = useLocation();
  const [contraido, setContraido] = useState(preferenciaInicial);
  const [esMovil, setEsMovil] = useState(() => window.matchMedia?.(CONSULTA_MOVIL).matches ?? false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia?.(CONSULTA_MOVIL);
    if (!consulta) return;
    const actualizar = () => { setEsMovil(consulta.matches); setMenuAbierto(false); };
    actualizar();
    consulta.addEventListener('change', actualizar);
    return () => consulta.removeEventListener('change', actualizar);
  }, []);

  useEffect(() => { setMenuAbierto(false); }, [rutaActual]);

  function alternarMenu() {
    if (esMovil) { setMenuAbierto((valor) => !valor); return; }
    const siguiente = !contraido;
    setContraido(siguiente);
    try { localStorage.setItem(SIDEBAR_KEY, String(siguiente)); } catch { /* Preferencia en memoria. */ }
  }

  return (
    <InternalUIContext.Provider value>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" />
      <div className="labzen-internal lz-layout" data-sidebar={contraido ? 'contraido' : 'expandido'}>
        <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
        {!esMovil && <Sidebar id="navegacion-interna" contraido={contraido} />}
        <div className="lz-workspace">
          <Header esMovil={esMovil} menuExpandido={esMovil ? menuAbierto : !contraido} onAlternarMenu={alternarMenu} />
          <main id="contenido-principal" tabIndex={-1} className="lz-main">
            <div className="lz-page"><Outlet /></div>
          </main>
        </div>
        <Modal abierto={esMovil && menuAbierto} titulo="Menú de navegación" variante="lateral" onCerrar={() => setMenuAbierto(false)}>
          <Sidebar id="navegacion-interna" contraido={false} onNavegar={() => setMenuAbierto(false)} />
        </Modal>
      </div>
    </InternalUIContext.Provider>
  );
}
