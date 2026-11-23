/**
 * ThresholdControl.tsx
 * Controle deslizante do limiar de intensidade (0 a 255) usado na
 * segmentação. Exibe o valor atual ao lado do título e as opções de
 * limiar automático (Otsu) e de preenchimento de buracos.
 */

// Props
interface ThresholdControlProps {
  // limiar atual e seu setter
  threshold: number;
  setThreshold: (value: number) => void;
  // limiar automático (Otsu) e seu setter
  autoThreshold: boolean;
  setAutoThreshold: (value: boolean) => void;
  // limiar calculado pelo backend no modo automático (null antes de segmentar)
  thresholdUsed: number | null;
  // preenchimento de buracos e seu setter
  fillHoles: boolean;
  setFillHoles: (value: boolean) => void;
}

export function ThresholdControl({
  threshold,
  setThreshold,
  autoThreshold,
  setAutoThreshold,
  thresholdUsed,
  fillHoles,
  setFillHoles,
}: ThresholdControlProps) {
  // no modo automático mostra o valor calculado por Otsu (quando já existe)
  const displayed = autoThreshold ? (thresholdUsed ?? 'auto') : threshold;

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
          {displayed}
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
          value={autoThreshold && thresholdUsed !== null ? thresholdUsed : threshold}
          disabled={autoThreshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="slider w-full disabled:cursor-not-allowed disabled:opacity-40"
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

      {/* Opções da segmentação */}
      <div className="space-y-2 text-xs">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoThreshold}
            onChange={(event) => setAutoThreshold(event.target.checked)}
            style={{ accentColor: 'var(--color-olive-green)' }}
          />
          Limiar automático (Otsu)
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={fillHoles}
            onChange={(event) => setFillHoles(event.target.checked)}
            style={{ accentColor: 'var(--color-olive-green)' }}
          />
          Preencher buracos (vasos)
        </label>
      </div>
    </section>
  );
}