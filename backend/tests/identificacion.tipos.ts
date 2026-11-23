// Prueba estática: compilar con tsc --noEmit --strict. No se ejecuta como suite ni se importa en producción.
import {
  aIdentificacionPublica,
  type IdentificacionDocumentada,
  type IdentificacionLegada,
  type IdentificacionNueva,
  type IdentificacionSinDocumento,
} from '../src/domain/identificacion/identificacion';

function comprobarTipos(documentada: IdentificacionDocumentada,
  ausencia: IdentificacionSinDocumento, legado: IdentificacionLegada): void {
  if (documentada.tipo === 'PA') {
    const pais: string = documentada.paisEmisor;
    void pais;
  } else {
    const pais: null = documentada.paisEmisor;
    void pais;
  }
  const publico = aIdentificacionPublica(documentada);
  // @ts-expect-error La clave interna no forma parte del contrato público.
  void publico.claveCanonica;
  // @ts-expect-error Los valores validados son readonly.
  documentada.numero = 'OTRO';
  // @ts-expect-error Una ausencia no puede contener un tipo documental.
  const contradictoria: IdentificacionNueva = { ...ausencia, tipo: 'CC' };
  // @ts-expect-error Pasaporte requiere país no nulo en su representación interna.
  const sinPais: IdentificacionNueva = { ...documentada, tipo: 'PA', paisEmisor: null };
  // @ts-expect-error Emisor fijo se almacena como null, no como otro país.
  const emisorFijoInvalido: IdentificacionNueva = { ...documentada, tipo: 'CC', paisEmisor: 'VE' };
  // @ts-expect-error Legado no puede utilizarse como identificación de nueva admisión.
  const nuevaDesdeLegado: IdentificacionNueva = legado;
  // @ts-expect-error Ausencia documental requiere motivo textual.
  const sinMotivo: IdentificacionSinDocumento = { ...ausencia, motivoAusencia: null };
  void [contradictoria, sinPais, emisorFijoInvalido, nuevaDesdeLegado, sinMotivo];
}

void comprobarTipos;
