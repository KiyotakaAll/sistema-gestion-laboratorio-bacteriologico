import { useRef, useState } from 'react';
import { documentosApi } from '../../services/documentos';
import { mensajeDeError } from '../../services/api';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';

export function DocumentoAcciones({ clase, solicitudId, disabled = false }: {
  clase: 'informe' | 'orden' | 'remision'; solicitudId?: number; disabled?: boolean;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  const etiqueta = clase === 'informe' ? 'Informe final' : clase === 'orden' ? 'Orden' : 'Remisión vacía';
  async function abrir(imprimir: boolean) {
    if (enCurso.current) return;
    enCurso.current = true;
    const ventana = imprimir ? window.open('', '_blank') : null;
    if (imprimir && !ventana) { enCurso.current = false; setError('Permita abrir la pestaña del PDF o utilice la descarga.'); return; }
    setCargando(true); setError(null);
    try {
      const blob = await documentosApi.obtener(clase, solicitudId);
      const url = URL.createObjectURL(blob);
      if (ventana) {
        ventana.opener = null;
        ventana.location.replace(url);
        // El visor PDF del navegador ofrece impresión, sin enviar datos a terceros.
      } else {
        const enlace = document.createElement('a'); enlace.href = url;
        enlace.download = `labzen-${clase}${solicitudId ? `-${solicitudId}` : ''}.pdf`;
        enlace.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { ventana?.close(); setError(mensajeDeError(e)); }
    finally { enCurso.current = false; setCargando(false); }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button tamano="sm" disabled={disabled} cargando={cargando} onClick={() => void abrir(false)}>{etiqueta} PDF</Button>
      <Button tamano="sm" disabled={disabled || cargando} onClick={() => void abrir(true)}>Imprimir {etiqueta.toLowerCase()}</Button>
    </div>
    {error && <Alert>{error}</Alert>}
  </div>;
}
