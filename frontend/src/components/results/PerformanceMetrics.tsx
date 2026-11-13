/**
 * PerformanceMetrics.tsx
 * Cartão com os tempos de execução da segmentação (processamento, cópia de
 * dados entre CPU e GPU e tempo total), em milissegundos.
 */

import { Cpu, Zap } from 'lucide-react';
import type { EngineType, Metrics } from '../../types/segmentation';

// Props
interface PerformanceMetricsProps {
  // tempos retornados pelo backend
  metrics: Metrics;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  // motor usado, exibido no título e no ícone
  engine: EngineType;
}

// Utilitários
// formata o tempo em milissegundos com 2 casas decimais
function formatTime(value: number): string {
  return `${value.toFixed(2)} ms`;
}

export function PerformanceMetrics({
  metrics,
  hasSegmented,
  engine,
}: PerformanceMetricsProps) {
  return (
    <div
      className="flex flex-col justify-between rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div>
        {/* Título e ícone do motor */}
        <div className="mb-4 flex items-center justify-between">
          <h3
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Desempenho ({engine.toUpperCase()})
          </h3>
          {engine === 'gpu' ? (
            <Zap
              className="h-4 w-4"
              style={{ color: 'var(--color-soft-blue)' }}
            />
          ) : (
            <Cpu
              className="h-4 w-4"
              style={{ color: 'var(--color-soft-blue)' }}
            />
          )}
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Tempo do kernel (processamento em si) */}
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Processamento:
            </span>
            <span className="font-mono font-medium">
              {hasSegmented ? formatTime(metrics.kernelTime) : '—'}
            </span>
          </div>

          {/* Cópia de dados: H2D (Host to Device, CPU para GPU) + D2H (Device to Host, GPU para CPU) */}
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Cópia CPU / GPU:
            </span>
            <span className="font-mono font-medium">
              {hasSegmented ? formatTime(metrics.transferTime) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Tempo total da requisição */}
      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-semibold"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span>Tempo Total:</span>
        <span
          className="font-mono text-sm"
          style={{ color: 'var(--color-soft-blue)' }}
        >
          {hasSegmented ? formatTime(metrics.totalTime) : '0.00 ms'}
        </span>
      </div>
    </div>
  );
}