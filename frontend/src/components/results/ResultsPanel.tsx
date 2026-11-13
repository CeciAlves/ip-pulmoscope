/**
 * ResultsPanel.tsx
 * Painel lateral direito que reúne os cartões de resultado: áreas,
 * desempenho e exportação. Apenas organiza os componentes, sem lógica própria.
 */

import type { EngineType, Metrics } from '../../types/segmentation';
import { AreaMetrics } from './AreaMetrics';
import { ExportButtons } from './ExportButtons';
import { PerformanceMetrics } from './PerformanceMetrics';

// Props
interface ResultsPanelProps {
  // áreas e tempos da segmentação
  metrics: Metrics;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  // motor usado no processamento
  engine: EngineType;
}

export function ResultsPanel({
  metrics,
  hasSegmented,
  engine,
}: ResultsPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4">
      <AreaMetrics metrics={metrics} hasSegmented={hasSegmented} />
      <PerformanceMetrics
        metrics={metrics}
        hasSegmented={hasSegmented}
        engine={engine}
      />
      <ExportButtons hasSegmented={hasSegmented} />
    </section>
  );
}