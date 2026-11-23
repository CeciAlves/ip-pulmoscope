/**
 * ResultsPanel.tsx
 * Painel lateral direito que reúne os cartões de resultado: áreas,
 * desempenho, avisos do processamento e exportação. Apenas organiza os
 * componentes, sem lógica própria.
 */

import { AlertTriangle, Target } from 'lucide-react';
import type { EngineType, Metrics } from '../../types/segmentation';
import { AreaMetrics } from './AreaMetrics';
import { ExportButtons } from './ExportButtons';
import type { ExportData } from './ExportButtons';
import { PerformanceMetrics } from './PerformanceMetrics';

// Props
interface ResultsPanelProps {
  // áreas e tempos da segmentação
  metrics: Metrics;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  // motor selecionado e motor que realmente processou (null antes de segmentar)
  engine: EngineType;
  engineUsed: EngineType | null;
  // avisos retornados pelo backend
  warnings: string[];
  // dados usados na exportação
  exportData: ExportData;
}

export function ResultsPanel({
  metrics,
  hasSegmented,
  engine,
  engineUsed,
  warnings,
  exportData,
}: ResultsPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4">
      <AreaMetrics metrics={metrics} hasSegmented={hasSegmented} />
      <PerformanceMetrics
        metrics={metrics}
        hasSegmented={hasSegmented}
        engine={engineUsed ?? engine}
      />

      {/* Qualidade: Dice e IoU contra a máscara de referência (ambos os pulmões) */}
      {hasSegmented && metrics.dice !== null && metrics.iou !== null && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            borderColor: 'var(--color-border)',
          }}
        >
          <h3
            className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Target className="h-3.5 w-3.5" />
            Qualidade da Segmentação
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Dice', value: metrics.dice },
              { label: 'IoU', value: metrics.iou },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {label}
                </p>
                <p className="text-lg font-semibold">{value.toFixed(4)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            Comparação da máscara dos dois pulmões com a referência enviada.
          </p>
        </div>
      )}

      {/* Avisos do processamento (fallback para CPU, imagem fora do padrão etc.) */}
      {hasSegmented && warnings.length > 0 && (
        <div
          className="space-y-1.5 rounded-xl border p-4 text-[11px] text-amber-300"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            borderColor: 'var(--color-border)',
          }}
        >
          {warnings.map((warning) => (
            <p key={warning} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}

      <ExportButtons hasSegmented={hasSegmented} data={exportData} />
    </section>
  );
}
