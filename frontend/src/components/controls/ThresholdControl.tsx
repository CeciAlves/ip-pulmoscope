/**
 * ThresholdControl.tsx
 * Controle deslizante do limiar de intensidade (0 a 255) usado na
 * segmentação. Exibe o valor atual ao lado do título.
 */

// Props
interface ThresholdControlProps {
  // limiar atual e seu setter
  threshold: number;
  setThreshold: (value: number) => void;
}

export function ThresholdControl({
  threshold,
  setThreshold,
}: ThresholdControlProps) {
  return (
    <section className="space-y-3">
      {/* Título e valor atual */}
      <div className="flex items-center justify-between">
        <h2
          className="text-[11px] font-semibold tracking-wider uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          2. Limiar de intensidade
        </h2>

        <span
          className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-soft-blue)',
          }}
        >
          {threshold}
        </span>
      </div>

      {/* Slider (a classe "slider" é estilizada no global.css) */}
      <div className="pt-1">
        <input
          id="threshold"
          type="range"
          aria-label="Limiar de intensidade"
          min={0}
          max={255}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="slider w-full"
        />

        {/* referência da escala: pixels escuros (ar) a claros (osso) */}
        <div
          className="mt-1.5 flex justify-between text-[10px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>0 (Ar)</span>
          <span>255 (Osso)</span>
        </div>
      </div>
    </section>
  );
}