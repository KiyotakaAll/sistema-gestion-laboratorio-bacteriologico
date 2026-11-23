import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import { AppError } from '../types/errors';
import { diaColombia, edadCivil } from '../domain/fechaCivil';
import type { SolicitudDocumento, MuestraDocumento } from '../domain/documentos';

const MORADO = '#60379a';
const rutaFuente = join(__dirname, '../../assets/fonts/DejaVuSans.ttf');
const fontkit = require('fontkit') as { openSync: (ruta: string) => { hasGlyphForCodePoint: (codigo: number) => boolean } };
const fuente = fontkit.openSync(rutaFuente);
const fecha = (d: Date) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(d);
const civil = (d: Date) => d.toISOString().slice(0, 10);

/** Tablas con altura medida, encabezados repetidos y continuación explícita de celdas extensas. */
class DocumentoLabZen {
  readonly doc: PDFKit.PDFDocument;
  private y = 128;
  private readonly ancho = 507;
  private readonly limite = 782;
  constructor(private titulo: string, private numero: string, private emitido: Date) {
    this.doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true,
      info: { Producer: 'LabZen', Creator: 'LabZen', Title: titulo } });
    this.doc.registerFont('Cuerpo', rutaFuente);
    this.doc.registerFont('CuerpoNegrita', join(__dirname, '../../assets/fonts/DejaVuSans-Bold.ttf'));
    this.cabecera();
    this.doc.on('pageAdded', () => this.cabecera());
  }
  private cabecera() {
    this.doc.fillColor(MORADO).font('Times-Bold').fontSize(28).text('LabZen', 44, 30);
    this.doc.font('Cuerpo').fontSize(9).fillColor('#505466').text('Laboratorio bacteriológico', 44, 65);
    this.doc.fontSize(8).text(`Emisión: ${fecha(this.emitido)} (Colombia)`, 285, 42, { width: 266, align: 'right' });
    this.doc.text(this.numero, 285, 60, { width: 266, align: 'right' });
    this.doc.moveTo(44, 86).lineTo(551, 86).strokeColor(MORADO).stroke();
    this.doc.font('CuerpoNegrita').fontSize(12).fillColor(MORADO).text(this.titulo, 44, 98, { width: this.ancho });
    this.y = 128;
  }
  private espacio(alto: number) { if (this.y + alto > this.limite) this.doc.addPage(); }
  seccion(titulo: string) {
    this.doc.font('CuerpoNegrita').fontSize(11);
    this.lineas(titulo, this.ancho);
    const alto = this.doc.heightOfString(titulo, { width: this.ancho });
    this.espacio(alto + 48);
    this.doc.font('CuerpoNegrita').fontSize(11).fillColor(MORADO).text(titulo, 44, this.y, { width: this.ancho });
    this.y += alto + 10;
  }
  private lineas(texto: string, ancho: number): string[] {
    if (Array.from(texto).some(c => !/\s/.test(c) && !fuente.hasGlyphForCodePoint(c.codePointAt(0)!)))
      throw new AppError(422, 'El documento contiene caracteres sin representación en la fuente PDF. Revise el registro sin sustituir datos clínicos.', 'PDF_CARACTER_NO_SOPORTADO');
    const lineas: string[] = [];
    for (const parrafo of texto.split('\n')) {
      let linea = '';
      for (const palabra of parrafo.split(/\s+/)) {
        if (!palabra) continue;
        if (this.doc.widthOfString(`${linea} ${palabra}`.trim()) <= ancho) linea = `${linea} ${palabra}`.trim();
        else {
          if (linea) lineas.push(linea);
          linea = '';
          for (const caracter of palabra) {
            if (this.doc.widthOfString(linea + caracter) > ancho) { lineas.push(linea); linea = ''; }
            linea += caracter;
          }
        }
      }
      lineas.push(linea);
    }
    return lineas.length ? lineas : [''];
  }
  tabla(cabeceras: string[], filas: string[][], proporciones = cabeceras.map(() => 1)) {
    const total = proporciones.reduce((a,b) => a+b,0);
    const anchos = proporciones.map(p => this.ancho*p/total);
    const encabezado = () => {
      this.espacio(32);
      this.doc.rect(44, this.y, this.ancho, 25).fill('#eee7f5');
      let x=44;
      cabeceras.forEach((t,i) => {
        this.doc.font('CuerpoNegrita').fontSize(9).fillColor('#30233e').text(t,x+7,this.y+7,{width:anchos[i]!-14,height:16}); x+=anchos[i]!;
      }); this.y+=25;
    };
    this.doc.font('Cuerpo').fontSize(9);
    const primeraAltura = Math.min(38, Math.max(1, ...cabeceras.map((_,i) => this.lineas(filas[0]?.[i] || '—', anchos[i]!-14).length))) * 12 + 14;
    this.espacio(25 + primeraAltura);
    encabezado();
    for (const fila of filas) {
      this.doc.font('Cuerpo').fontSize(9);
      const celdas = cabeceras.map((_,i) => this.lineas(fila[i] || '—', anchos[i]!-14));
      let offset=0;
      const maximo=Math.max(...celdas.map(c=>c.length));
      while(offset<maximo) {
        // Una celda demasiado larga continúa en otra fila, nunca se recorta.
        let cantidad=Math.min(38,maximo-offset);
        let alto=cantidad*12+14;
        if(this.y+alto>this.limite) {
          this.doc.addPage(); encabezado();
        }
        cantidad=Math.min(cantidad,Math.floor((this.limite-this.y-14)/12));
        alto=cantidad*12+14;
        this.doc.rect(44,this.y,this.ancho,alto).lineWidth(0.5).strokeColor('#d9d4e0').stroke();
        let x=44;
        celdas.forEach((celda,i)=>{
          this.doc.font('Cuerpo').fontSize(9).fillColor('#242331');
          celda.slice(offset,offset+cantidad).forEach((linea,n)=>this.doc.text(linea,x+7,this.y+7+n*12,{width:anchos[i]!-14,height:12,lineBreak:false}));
          x+=anchos[i]!;
        });
        offset+=cantidad; this.y+=alto;
      }
    }
    this.y+=14;
  }
  texto(texto: string) {
    this.doc.font('Cuerpo').fontSize(9);
    const lineas = this.lineas(texto, this.ancho);
    for (const linea of lineas) {
      this.espacio(13);
      this.doc.font('Cuerpo').fontSize(9).fillColor('#505466').text(linea,44,this.y,{width:this.ancho,height:13,lineBreak:false});
      this.y += 13;
    }
    this.y += 12;
  }
  terminar(): Promise<Buffer> {
    const rango=this.doc.bufferedPageRange();
    for(let i=rango.start;i<rango.start+rango.count;i++) {
      this.doc.switchToPage(i);
      const anterior=this.doc.page.margins.bottom; this.doc.page.margins.bottom=0;
      this.doc.font('Cuerpo').fontSize(8).fillColor('#655d70').text(
        `${this.numero} · Confidencial · Página ${i+1} de ${rango.count}`,44,806,{width:this.ancho,align:'center',height:12,lineBreak:false});
      this.doc.page.margins.bottom=anterior;
    }
    return new Promise((resolve,reject)=>{
      const partes:Buffer[]=[];
      this.doc.on('data',p=>partes.push(p)); this.doc.on('error',reject);
      this.doc.on('end',()=>resolve(Buffer.concat(partes))); this.doc.end();
    });
  }
}

function identidad(s: SolicitudDocumento, pdf: DocumentoLabZen) {
  const p=s.paciente;
  const documento=p.estadoIdentificacion==='DOCUMENTADO'
    ? `${p.tipoDocumento} ${p.numeroDocumento}${p.paisEmisorDocumento ? ` · ${p.paisEmisorDocumento}` : ''}`
    : p.cedula ? `Identificación histórica: ${p.cedula}`
      : p.estadoIdentificacion==='SIN_DOCUMENTO_ASIGNADO' ? 'Sin documento asignado'
        : 'Documento no disponible';
  pdf.tabla(['Dato','Información'],[
    ['Paciente',`${p.apellidos}, ${p.nombres}`],
    ['Identificación',`${documento} · ID interno ${p.id}`],
    ['Nacimiento',civil(p.fechaNacimiento)],
    ['Solicitud',`${s.codigo} · ${fecha(s.fechaSolicitud)} · ${s.prioridad}`],
    ['Médico remitente',s.medicoRemitenteNombre ?? s.medicoSolicitante ?? 'No registrado'],
  ],[1,3]);
}

export async function generarInformePdf(s: SolicitudDocumento, muestras: MuestraDocumento[], emision=new Date()) {
  const pdf=new DocumentoLabZen('INFORME FINAL DE RESULTADOS',`INF-${s.codigo}`,emision);
  identidad(s,pdf);
  for(const m of muestras) {
    pdf.seccion(`Muestra ${m.codigoBarras}`);
    const edad=edadCivil(civil(s.paciente.fechaNacimiento),diaColombia(m.fechaToma));
    pdf.tabla(['Dato','Información'],[
      ['Material y sitio',`${m.tipoMuestra}${m.sitioAnatomico ? ` · ${m.sitioAnatomico}` : ''}`],
      ['Toma / recepción',`${fecha(m.fechaToma)} / ${m.fechaRecepcion ? fecha(m.fechaRecepcion) : 'No registrada'}`],
      ['Edad a la toma',edad ? `${edad.valor} ${edad.valor === 1 ? ({ años: 'año', meses: 'mes', días: 'día' } as const)[edad.unidad] : edad.unidad}` : 'No disponible'],
    ],[1,3]);
    for(const e of m.examenes) {
      const r=e.resultado!;
      pdf.seccion(`${e.examen.codigo} · ${e.examen.nombre}`);
      const filas=[['Hallazgo Gram',r.hallazgoGram],['Colonias',r.colonias],['Bacteria aislada',r.bacteriaAislada],['Observaciones del resultado validado',r.observaciones]]
        .filter((f): f is [string,string]=>!!f[1]);
      pdf.tabla(['Hallazgo','Resultado registrado'],filas,[1,3]);
      if(r.antibiograma.length) {
        pdf.seccion('Antibiograma');
        pdf.tabla(['Antibiótico','Categoría registrada','Halo (mm)'],r.antibiograma.map(a=>[
          a.antibiotico,a.sensibilidad,a.haloMm==null?'No registrado':String(a.haloMm),
        ]),[2,1,1]);
      }
      pdf.tabla(['Responsabilidad','Profesional y fecha'],[
        ['Registró',`${r.registradoPor.nombreCompleto} · ${fecha(r.fechaRegistro)}`],
        ['Validó',`${r.validadoPor!.nombreCompleto} · ${fecha(r.fechaValidacion!)}`],
      ],[1,3]);
    }
  }
  pdf.texto('Validación electrónica registrada en LabZen por los profesionales indicados. No representa una firma manuscrita ni una firma digital certificada.');
  return pdf.terminar();
}

export async function generarOrdenPdf(s: SolicitudDocumento, emision=new Date()) {
  const pdf=new DocumentoLabZen('ORDEN DE LABORATORIO · SIN RESULTADOS',`ORD-${s.codigo}`,emision);
  identidad(s,pdf);
  const lineas=s.examenesSolicitados?.length ? s.examenesSolicitados
    : s.muestras.flatMap(m=>m.examenes.map(e=>({examen:e.examen,tipoMuestra:m.tipoMuestra,sitioAnatomico:m.sitioAnatomico,instruccionesToma:null})));
  pdf.seccion('Exámenes solicitados');
  pdf.tabla(['Examen','Muestra / sitio','Instrucciones del catálogo'],lineas.map(l=>[
    `${l.examen.codigo} · ${l.examen.nombre}`,`${l.tipoMuestra}${l.sitioAnatomico?` · ${l.sitioAnatomico}`:''}`,
    l.instruccionesToma ?? 'No registradas',
  ]),[2,1.5,2]);
  if(!lineas.length) pdf.texto('La solicitud histórica todavía no tiene exámenes asociados. No se añaden exámenes automáticamente.');
  if(s.diagnosticoPresuntivo) pdf.texto(`Motivo / diagnóstico presuntivo proporcionado: ${s.diagnosticoPresuntivo}`);
  if(s.observaciones) pdf.texto(`Observaciones de la solicitud: ${s.observaciones}`);
  return pdf.terminar();
}

export async function generarRemisionVaciaPdf(emision=new Date()) {
  const pdf=new DocumentoLabZen('REMISIÓN EN BLANCO · SIN RESULTADOS','FORMATO DE REMISIÓN',emision);
  pdf.tabla(['Campo','Diligenciar'],[
    ['Paciente','________________________________________________'],['Identificación / nacimiento','________________________________________________'],
    ['Médico / institución','________________________________________________'],['Registro profesional (si dispone)','________________________________________________'],
    ['Fecha / prioridad','________________________________________________'],
  ],[1,3]);
  pdf.seccion('Exámenes solicitados');
  pdf.tabla(['Examen','Tipo de muestra','Sitio anatómico'],Array.from({length:7},()=>['____________________','________________','________________']),[2,1.5,1.5]);
  pdf.tabla(['Información proporcionada','Diligenciar'],[
    ['Motivo / diagnóstico (si se proporciona)','________________________________________'],
    ['Observaciones','________________________________________'],['Profesional remitente / firma','________________________________________'],
  ],[1,2]);
  return pdf.terminar();
}
