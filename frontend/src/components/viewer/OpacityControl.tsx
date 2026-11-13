/**
 * OpacityControl.tsx
 * Controle deslizante de opacidade (0 a 100%) da máscara sobreposta.
 * Componente controlado: o valor e o setter vêm do componente pai.
 */

import { Layers } from 'lucide-react';

// Props
interface OpacityControlProps {
  // opacidade atual (%) e seu setter
  opacity: number;
  setOpacity: (value: number) => void;
}

export function OpacityControl({
  opacity,
  setOpacity,
}: OpacityControlProps) {
  return (
    <div className="flex items-center space-x-3 px-3">
      {/* Rótulo com ícone */}
      <span
        className="flex items-center gap-1.5 text-xs font-medium"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Layers
          className="h-3.5 w-3.5"
          style={{ color: 'var(--color-soft-blue)' }}
        />
        Opacidade:
      </span>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={opacity}
        onChange={(event) => setOpacity(Number(event.target.value))}
        className="h-1.5 w-28 cursor-pointer appearance-none rounded-lg"
        style={{
          backgroundColor: 'var(--color-border)',
          accentColor: 'var(--color-olive-green)',
        }}
        aria-label="Opacidade da sobreposição"
      />

      {/* Valor atual (largura fixa para não "pular" ao mudar de dígitos) */}
      <span
        className="w-8 font-mono text-xs"
        style={{ color: 'var(--color-cream)' }}
      >
        {opacity}%
      </span>
    </div>
  );
}