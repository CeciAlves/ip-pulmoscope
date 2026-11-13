/**
 * ExportButtons.tsx
 * Cartão com os botões de exportação do resultado (máscara em PNG e
 * métricas em CSV). Habilitados somente após a segmentação.
 *
 * TODO: os botões ainda NÃO têm ação!! Falta implementar o onClick de cada um:
 *  - Baixar Máscara (PNG): gerar o arquivo a partir da máscara (maskUrl) ou do canvas.
 *  - Exportar Métricas (CSV): montar o CSV com os valores de Metrics.
 */

import { Download, FileSpreadsheet } from 'lucide-react';

// Props
interface ExportButtonsProps {
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
}

export function ExportButtons({ hasSegmented }: ExportButtonsProps) {
  return (
    <div
      className="flex flex-col justify-between rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      <h3
        className="mb-3 text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Exportar Resultados
      </h3>

      <div className="space-y-2.5">
        {/* TODO: exportar máscara em PNG (sem onClick por enquanto) */}
        <button
          type="button"
          disabled={!hasSegmented}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Download
            className="h-3.5 w-3.5"
            style={{ color: 'var(--color-olive-green)' }}
          />
          Baixar Máscara (PNG)
        </button>

        {/* TODO: exportar métricas em CSV (sem onClick por enquanto) */}
        <button
          type="button"
          disabled={!hasSegmented}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <FileSpreadsheet
            className="h-3.5 w-3.5"
            style={{ color: 'var(--color-olive-green)' }}
          />
          Exportar Métricas (CSV)
        </button>
      </div>
    </div>
  );
}