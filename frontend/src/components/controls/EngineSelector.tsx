/**
 * EngineSelector.tsx
 * Seletor do motor de processamento (GPU/CUDA ou CPU). Mostra dois botões
 * e destaca o ativo. O estado fica no App, aqui só se exibe e se notifica a troca.
 */

import { Cpu, Zap } from 'lucide-react';
import type { EngineType } from '../../types/segmentation';

// Constantes
// opções exibidas como botões (valor enviado ao backend, rótulo e ícone)
const ENGINE_OPTIONS: { value: EngineType; label: string; icon: typeof Zap }[] = [
  { value: 'gpu', label: 'GPU (CUDA)', icon: Zap },
  { value: 'cpu', label: 'CPU', icon: Cpu },
];

// Props
interface EngineSelectorProps {
  // motor selecionado e seu setter
  engine: EngineType;
  setEngine: (value: EngineType) => void;
  // false quando o servidor não tem GPU (null = ainda não consultado)
  gpuAvailable: boolean | null;
}

export function EngineSelector({ engine, setEngine, gpuAvailable }: EngineSelectorProps) {
  return (
    <section className="space-y-3">
      <h2
        className="text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        4. Motor de processamento
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {ENGINE_OPTIONS.map(({ value, label, icon: Icon }) => {
          // destaca o botão do motor selecionado
          const isActive = engine === value;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setEngine(value)}
              className="flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition"
              style={{
                backgroundColor: isActive
                  ? 'rgba(115, 136, 57, 0.16)'
                  : 'var(--color-bg-base)',
                borderColor: isActive
                  ? 'var(--color-olive-green)'
                  : 'var(--color-border)',
                color: isActive ? 'var(--color-cream)' : 'var(--color-text-muted)',
              }}
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{
                  color: isActive ? 'var(--color-olive-green)' : 'inherit',
                }}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* sem GPU no servidor, a opção GPU cai para a CPU automaticamente */}
      {gpuAvailable === false && (
        <p className="text-[11px] text-amber-300">
          GPU indisponível no servidor: o processamento será feito na CPU.
        </p>
      )}
    </section>
  );
}