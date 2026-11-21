import { parse } from 'postcss';
import { expect, it } from 'vitest';
import css from '../internal.css?raw';

it('limita todas las reglas visuales nuevas al ámbito interno, incluidos tema y responsive', () => {
  parse(css).walkRules((regla) => {
    if (regla.parent?.type === 'atrule' && regla.parent.name === 'keyframes') return;
    for (const selector of regla.selectors) expect(selector).toContain('.labzen-internal');
  });
});
