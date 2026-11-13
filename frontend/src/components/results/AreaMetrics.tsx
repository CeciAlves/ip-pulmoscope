/**
 * AreaMetrics.tsx
 * Cartão com a área segmentada de cada pulmão e a área total, em pixels.
 * Exibe zeros enquanto não há resultado de segmentação.
 */

import { CheckCircle2 } from 'lucide-react';
import type { Metrics } from '../../types/segmentation';

// Props
interface AreaMetricsProps {
  // áreas retornadas pelo backend
  metrics: Metrics;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
}

export function AreaMetrics({ metrics, hasSegmented }: AreaMetricsProps) {
  return (
    <div
      className="flex flex-col justify-between rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div>
        {/* Título e indicador de resultado disponível */}
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Área em Pixels
          </h3>
          <CheckCircle2
            className="h-4 w-4"
            style={{
              color: hasSegmented
                ? 'var(--color-olive-green)'
                : 'var(--color-border)',
            }}
          />
        </div>

        {/* Áreas por pulmão (lado do paciente; na imagem, o direito aparece à esquerda) */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Pulmão Direito:
            </span>
            <span className="font-mono font-medium">
              {hasSegmented
                ? `${metrics.rightArea.toLocaleString('pt-BR')} px`
                : '0 px'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Pulmão Esquerdo:
            </span>
            <span className="font-mono font-medium">
              {hasSegmented
                ? `${metrics.leftArea.toLocaleString('pt-BR')} px`
                : '0 px'}
            </span>
          </div>
        </div>
      </div>

      {/* Soma das duas áreas */}
      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-semibold"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span>Área Total:</span>
        <span className="font-mono text-sm">
          {hasSegmented
            ? `${metrics.totalArea.toLocaleString('pt-BR')} px`
            : '0 px'}
        </span>
      </div>
    </div>
  );
}