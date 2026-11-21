type Variant = 'blanco' | 'plano' | 'petroleo';

interface Props {
  variant?: Variant;
  size?: number;
  className?: string;
}

/** El SVG externo conserva los trazados y colores originales del kit.
 * El marco cuadrado mantiene las dimensiones de los símbolos provisionales. */
export function LabZenBrand({ variant = 'petroleo', size = 35, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 35 35" className={className}
      aria-hidden="true" focusable="false">
      <image href={`/branding/labzen/v1/labzen-isotipo-${variant}.svg`}
        width="35" height="35" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
