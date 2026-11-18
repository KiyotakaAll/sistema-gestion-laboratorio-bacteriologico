// Se ejecuta antes de cargar CSS/React para que el primer pintado respete el tema.
(function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem('labzen_preferences_v1') || '{}') || {}; } catch (_) {}
  var tema = ['claro', 'oscuro'].indexOf(p.tema) >= 0 ? p.tema
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  var root = document.documentElement;
  root.dataset.tema = tema;
  root.dataset.densidad = p.densidad === 'compacta' ? 'compacta' : 'comoda';
  root.dataset.movimiento = p.reducirMovimiento === true ? 'reducido' : 'sistema';
}());
