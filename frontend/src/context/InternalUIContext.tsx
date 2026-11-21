import { createContext, useContext } from 'react';

/** Se propaga a portales React sin aplicar estilos a body ni a las rutas públicas. */
export const InternalUIContext = createContext(false);
export const useInternalUI = () => useContext(InternalUIContext);
