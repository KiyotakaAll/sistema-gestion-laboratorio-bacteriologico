import type { CSSProperties } from 'react';
import { LabZenBrand } from '../branding/LabZenBrand';

// Composición e ilustraciones del HTML v5 aprobado, expresadas en JSX.
export function BrandIcon({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
  return <LabZenBrand variant={sobreOscuro ? 'blanco' : 'petroleo'} className="brand-icon" />;
}

export function ScientificAtmosphere() {
  return (
    <div aria-hidden="true" className="hero-atmosphere">
  <svg className="ambient-lines" fill="none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1100 900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="streamA" x1="0" x2="1000" y1="0" y2="650">
        <stop stopColor="#9BFFF0" stopOpacity="0"></stop>
        <stop offset=".38" stopColor="#6CF4E5" stopOpacity=".22"></stop>
        <stop offset="1" stopColor="#9BFFF0" stopOpacity="0"></stop>
      </linearGradient>
    </defs>
    <path d="M-130 666 C 130 480 326 781 568 497 S 948 354 1240 190" stroke="url(#streamA)" strokeWidth="1.4"></path>
    <path d="M-130 716 C 120 525 360 826 600 541 S 996 400 1260 241" stroke="url(#streamA)" strokeWidth=".85"></path>
    <path d="M-150 768 C 115 570 380 866 620 582 S 998 442 1275 285" stroke="url(#streamA)" strokeWidth=".65"></path>
  </svg>
  <span className="microbe" style={{"--px": "13%", "--py": "23%", "--s": "24px", "--delay": "-3s", "--dur": "19s", "--rot": "25deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "33%", "--py": "68%", "--s": "17px", "--delay": "-9s", "--dur": "23s", "--rot": "-32deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "47%", "--py": "20%", "--s": "19px", "--delay": "-13s", "--dur": "18s", "--rot": "44deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "22%", "--py": "79%", "--s": "12px", "--delay": "-16s", "--dur": "26s", "--rot": "12deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "64%", "--py": "57%", "--s": "16px", "--delay": "-8s", "--dur": "21s", "--rot": "62deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "79%", "--py": "19%", "--s": "11px", "--delay": "-2s", "--dur": "24s", "--rot": "-20deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "89%", "--py": "74%", "--s": "15px", "--delay": "-12s", "--dur": "20s", "--rot": "35deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="microbe" style={{"--px": "54%", "--py": "86%", "--s": "9px", "--delay": "-18s", "--dur": "27s", "--rot": "20deg"} as CSSProperties}>
    <i></i>
  </span>
  <span className="micro-spark" style={{"--x": "15%", "--y": "62%", "--i": "1"} as CSSProperties}></span>
  <span className="micro-spark" style={{"--x": "43%", "--y": "30%", "--i": "2"} as CSSProperties}></span>
  <span className="micro-spark" style={{"--x": "56%", "--y": "75%", "--i": "3"} as CSSProperties}></span>
  <span className="micro-spark" style={{"--x": "70%", "--y": "29%", "--i": "4"} as CSSProperties}></span>
  <span className="micro-spark" style={{"--x": "88%", "--y": "54%", "--i": "5"} as CSSProperties}></span>
</div>
  );
}

export function PublicIntroduction() {
  return (
    <div className="left">
  <div className="logo">
    <span className="logo-symbol">
      <BrandIcon sobreOscuro />
    </span>
    {"Lab"}
    <b>{"Zen"}</b>
  </div>
  <div className="overline">{"PRECISIÓN EN CADA ETAPA"}</div>
  <h1>
    {"La ciencia de gestionar un laboratorio, "}
    <em>{"con claridad."}</em>
  </h1>
  <p>{"Una plataforma para conectar pacientes, solicitudes, muestras y resultados con precisión, trazabilidad y confianza."}</p>
  <a className="scrollcue" href="#conoce">
    {"Conoce la plataforma "}
    <span className="arrow">{"↓"}</span>
  </a>
</div>
  );
}

export function PublicInformation() {
  return (<>
    <section className="story-section" data-section-name="conoce" id="conoce">
  <div className="story-shell reveal">
    <div className="story-copy">
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" EL ENFOQUE LABZEN"}
      </div>
      <h2>
        {"La precisión empieza "}
        <span>{"mucho antes del análisis."}</span>
      </h2>
      <p>{"Un laboratorio funciona mejor cuando la información fluye sin obstáculos. LabZen reúne personas, solicitudes, muestras y resultados en un recorrido coherente."}</p>
      <a className="text-link" href="#funciones">
        {"Descubre el flujo "}
        <span>{"↗"}</span>
      </a>
      <div className="story-note">
        <span className="note-indicator"></span>
        {" Diseñado para acompañar el trabajo clínico, no para interrumpirlo."}
      </div>
    </div>
    <div aria-label="Visualización conceptual del recorrido de una muestra" className="story-visual">
      <div className="story-visual-top">
        <span>{"RECORRIDO DE UNA MUESTRA"}</span>
        <span className="live-pill">{"● Flujo conectado"}</span>
      </div>
      <div className="path-track">
        <div className="path-step">
          <span className="step-num">{"·"}</span>
          <div>
            <b>{"Admisión"}</b>
            <small>{"Identidad y solicitud"}</small>
          </div>
          <span className="step-check">{"✓"}</span>
        </div>
        <div className="path-connector"></div>
        <div className="path-step">
          <span className="step-num">{"·"}</span>
          <div>
            <b>{"Recepción"}</b>
            <small>{"Control de la muestra"}</small>
          </div>
          <span className="step-check">{"✓"}</span>
        </div>
        <div className="path-connector"></div>
        <div className="path-step active">
          <span className="step-num">{"·"}</span>
          <div>
            <b>{"Procesamiento"}</b>
            <small>{"Análisis bacteriológico"}</small>
          </div>
          <span className="step-pulse"></span>
        </div>
        <div className="path-connector"></div>
        <div className="path-step">
          <span className="step-num">{"·"}</span>
          <div>
            <b>{"Validación"}</b>
            <small>{"Revisión de resultados"}</small>
          </div>
          <span className="step-future">{"→"}</span>
        </div>
      </div>
      <div className="story-visual-bottom">{"Una misma historia. Cada etapa conectada."}</div>
    </div>
  </div>
</section>
    <section className="modules-section" data-section-name="funciones" id="funciones">
  <div className="modules-header reveal">
    <div>
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" LA PLATAFORMA"}
      </div>
      <h2>
        {"Cuatro procesos."}
        <br />
        <span>{"Una experiencia continua."}</span>
      </h2>
    </div>
    <p>{"Conoce cómo se organiza el trabajo. Selecciona una etapa para explorarla sin salir de esta página."}</p>
  </div>
  <div className="modules-grid">
    <a className="module-tile reveal" href="#pacientes">
      <span className="tile-index">{"ADMISIÓN"}</span>
      <div className="tile-art patient-art">
        <svg aria-hidden="true" className="tile-line-icon" fill="none" height="30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65" viewBox="0 0 24 24" width="30">
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4 21v-2a8 8 0 0 1 16 0v2"></path>
        </svg>
        <div className="art-person"></div>
        <div className="art-id">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
      <div className="tile-footer">
        <div>
          <h3>{"Pacientes y solicitudes"}</h3>
          <p>{"El punto de partida de cada atención."}</p>
        </div>
        <span className="tile-arrow">{"↗"}</span>
      </div>
    </a>
    <a className="module-tile reveal" href="#muestras">
      <span className="tile-index">{"TRAZABILIDAD"}</span>
      <div className="tile-art sample-art">
        <svg aria-hidden="true" className="tile-line-icon" fill="none" height="30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65" viewBox="0 0 24 24" width="30">
          <path d="M9 3h6M10 3v5l-4 9a3 3 0 0 0 2.7 4h6.6a3 3 0 0 0 2.7-4l-4-9V3M8 15h8"></path>
        </svg>
        <div className="sample-vial vial-a"></div>
        <div className="sample-vial vial-b"></div>
        <div className="sample-vial vial-c"></div>
      </div>
      <div className="tile-footer">
        <div>
          <h3>{"Control de muestras"}</h3>
          <p>{"Cada muestra, en su etapa correcta."}</p>
        </div>
        <span className="tile-arrow">{"↗"}</span>
      </div>
    </a>
    <a className="module-tile reveal" href="#resultados">
      <span className="tile-index">{"ANÁLISIS"}</span>
      <div className="tile-art result-art">
        <svg aria-hidden="true" className="tile-line-icon" fill="none" height="30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65" viewBox="0 0 24 24" width="30">
          <path d="M4 19V5M4 19h16M8 15l4-4 3 2 5-7"></path>
        </svg>
        <div className="result-chart">
          <span style={{"height": "36%"} as CSSProperties}></span>
          <span style={{"height": "62%"} as CSSProperties}></span>
          <span style={{"height": "48%"} as CSSProperties}></span>
          <span style={{"height": "84%"} as CSSProperties}></span>
          <span style={{"height": "70%"} as CSSProperties}></span>
        </div>
        <div className="result-line"></div>
      </div>
      <div className="tile-footer">
        <div>
          <h3>{"Resultados"}</h3>
          <p>{"Hallazgos organizados para su revisión."}</p>
        </div>
        <span className="tile-arrow">{"↗"}</span>
      </div>
    </a>
    <a className="module-tile reveal" href="#seguridad">
      <span className="tile-index">{"CONFIANZA"}</span>
      <div className="tile-art security-art">
        <svg aria-hidden="true" className="tile-line-icon" fill="none" height="30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65" viewBox="0 0 24 24" width="30">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
        <div className="shield-shape">
          <span>{"✓"}</span>
        </div>
        <div className="shield-orbit orbit-one"></div>
        <div className="shield-orbit orbit-two"></div>
      </div>
      <div className="tile-footer">
        <div>
          <h3>{"Seguridad y auditoría"}</h3>
          <p>{"Responsabilidades claras en cada acción."}</p>
        </div>
        <span className="tile-arrow">{"↗"}</span>
      </div>
    </a>
  </div>
</section>
    <section className="chapter chapter-light" data-section-name="pacientes" id="pacientes">
  <div className="chapter-inner reveal">
    <div className="chapter-text">
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" PACIENTES Y SOLICITUDES"}
      </div>
      <h2>
        {"Todo empieza con "}
        <em>{"una atención bien organizada."}</em>
      </h2>
      <p>{"El registro del paciente y su solicitud forman un punto de partida claro para el trabajo del laboratorio."}</p>
      <a className="text-link" href="#funciones">{"← Volver a los procesos"}</a>
    </div>
    <div aria-label="Ejemplo visual ilustrativo; no contiene datos reales" className="ui-preview">
      <div className="preview-header">
        <span className="preview-dot"></span>
        {" ADMISIÓN / VISTA CONCEPTUAL "}
        <span className="preview-tag">{"Flujo inicial"}</span>
      </div>
      <div className="preview-title">{"Nueva solicitud"}</div>
      <div className="preview-sub">{"Información organizada por etapas"}</div>
      <div className="preview-steps">
        <span className="done">{"Paciente"}</span>
        <span className="done">{"Solicitud"}</span>
        <span>{"Exámenes"}</span>
      </div>
      <div className="preview-form">
        <div>
          <small>{"PACIENTE"}</small>
          <b>{"Paciente seleccionado"}</b>
        </div>
        <div>
          <small>{"MÉDICO SOLICITANTE"}</small>
          <b>{"Seleccionar del catálogo ▾"}</b>
        </div>
      </div>
      <div className="preview-footer">
        <span>{"● Datos vinculados"}</span>
        <span aria-hidden="true">{"Continuar →"}</span>
      </div>
    </div>
  </div>
</section>
    <section className="chapter chapter-deep" data-section-name="muestras" id="muestras">
  <div className="chapter-inner reveal">
    <div className="chapter-text">
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" CONTROL DE MUESTRAS"}
      </div>
      <h2>
        {"Cada muestra tiene "}
        <em>{"su propio recorrido."}</em>
      </h2>
      <p>{"Una secuencia visible permite identificar en qué punto del proceso se encuentra una muestra y qué sucede después."}</p>
      <a className="text-link" href="#funciones">{"← Volver a los procesos"}</a>
    </div>
    <div aria-label="Ejemplo visual ilustrativo; no contiene datos reales" className="ui-preview">
      <div className="preview-header">
        <span className="preview-dot"></span>
        {" RECEPCIÓN / VISTA CONCEPTUAL "}
        <span className="preview-tag">{"Seguimiento"}</span>
      </div>
      <div className="preview-title">{"Estado de la muestra"}</div>
      <div className="preview-sub">{"Referencia ilustrativa · M-000124"}</div>
      <div className="preview-timeline">
        <div>
          <span>{"✓"}</span>
          <b>{"Registrada"}</b>
          <small>{"Ingreso"}</small>
        </div>
        <div>
          <span>{"✓"}</span>
          <b>{"Receptada"}</b>
          <small>{"Confirmación"}</small>
        </div>
        <div>
          <span className="current">{"●"}</span>
          <b>{"En proceso"}</b>
          <small>{"Análisis"}</small>
        </div>
      </div>
      <div className="preview-footer">
        <span>{"● Seguimiento por etapa"}</span>
        <span aria-hidden="true">{"Ver detalle ↗"}</span>
      </div>
    </div>
  </div>
</section>
    <section className="chapter chapter-light" data-section-name="resultados" id="resultados">
  <div className="chapter-inner reveal">
    <div className="chapter-text">
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" RESULTADOS BACTERIOLÓGICOS"}
      </div>
      <h2>
        {"Información clara para "}
        <em>{"decisiones responsables."}</em>
      </h2>
      <p>{"Los hallazgos se presentan con orden, de forma que el registro y la validación mantengan sus responsabilidades diferenciadas."}</p>
      <a className="text-link" href="#funciones">{"← Volver a los procesos"}</a>
    </div>
    <div aria-label="Ejemplo visual ilustrativo; no contiene datos reales" className="ui-preview">
      <div className="preview-header">
        <span className="preview-dot"></span>
        {" RESULTADOS / VISTA CONCEPTUAL "}
        <span className="preview-tag">{"Revisión"}</span>
      </div>
      <div className="preview-title">{"Detalle del resultado"}</div>
      <div className="preview-sub">{"Hallazgos bacteriológicos"}</div>
      <div className="preview-table">
        <div>
          <b>{"Parámetro"}</b>
          <b>{"Estado"}</b>
        </div>
        <div>
          <span>{"Registro de hallazgos"}</span>
          <span className="status-green">{"Completado"}</span>
        </div>
        <div>
          <span>{"Revisión profesional"}</span>
          <span className="status-amber">{"Pendiente"}</span>
        </div>
      </div>
      <div className="preview-footer">
        <span>{"● Doble validación de roles"}</span>
        <span aria-hidden="true">{"Consultar ↗"}</span>
      </div>
    </div>
  </div>
</section>
    <section className="chapter chapter-deep" data-section-name="seguridad" id="seguridad">
  <div className="chapter-inner reveal">
    <div className="chapter-text">
      <div className="eyebrow-v3">
        <span className="eyebrow-line"></span>
        {" SEGURIDAD Y TRAZABILIDAD"}
      </div>
      <h2>
        {"La confianza se construye "}
        <em>{"con trazabilidad."}</em>
      </h2>
      <p>{"Los permisos por rol y los registros de auditoría ayudan a mantener un seguimiento responsable de las operaciones."}</p>
      <a className="text-link" href="#funciones">{"← Volver a los procesos"}</a>
    </div>
    <div aria-label="Ejemplo visual ilustrativo; no contiene datos reales" className="ui-preview">
      <div className="preview-header">
        <span className="preview-dot"></span>
        {" SEGURIDAD / VISTA CONCEPTUAL "}
        <span className="preview-tag">{"Auditoría"}</span>
      </div>
      <div className="preview-title">{"Actividad registrada"}</div>
      <div className="preview-sub">{"Acciones vinculadas a sus responsables"}</div>
      <div className="audit-list">
        <div>
          <span className="audit-circle">{"✓"}</span>
          <span>
            <b>{"Registro de muestra"}</b>
            <small>{"Recepción"}</small>
          </span>
          <i>{"Registrado"}</i>
        </div>
        <div>
          <span className="audit-circle">{"✓"}</span>
          <span>
            <b>{"Resultado cargado"}</b>
            <small>{"Bacteriología"}</small>
          </span>
          <i>{"Registrado"}</i>
        </div>
        <div>
          <span className="audit-circle">{"✓"}</span>
          <span>
            <b>{"Resultado validado"}</b>
            <small>{"Validador"}</small>
          </span>
          <i>{"Registrado"}</i>
        </div>
      </div>
    </div>
  </div>
</section>
    <section className="end-section" data-section-name="cierre" id="cierre">
  <div className="end-glow"></div>
  <div className="reveal">
    <div className="eyebrow-v3">{"LABZEN · GESTIÓN DE LABORATORIO"}</div>
    <h2>
      {"La ciencia merece"}
      <br />
      <span>{"una experiencia a su altura."}</span>
    </h2>
    <p>{"Claridad en cada etapa. Precisión en cada proceso."}</p>
    <a aria-label="Volver al formulario de inicio de sesión" className="end-cta" href="#inicio">
      {"Volver a iniciar sesión "}
      <span>{"↑"}</span>
    </a>
    <div className="tiny">{"LabZen · v0.2.0 · Precisión y trazabilidad en cada proceso"}</div>
  </div>
</section>
  </>);
}
