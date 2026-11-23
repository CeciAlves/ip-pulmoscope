/**
 * Header.tsx
 * Cabeçalho fixo da aplicação, com o logotipo, o nome do sistema (PulmoScope)
 * e a etiqueta de protótipo educacional. Componente apenas visual, sem estado.
 */

import { Activity } from 'lucide-react';

export function Header() {
  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between border-b px-6"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Logotipo e título */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--color-dark-green)' }}
        >
          {/* Nota: Vamos tentar achar um icon de pulmão, esse tá nada a ver! 
          Mas mantive por simplicidade inicial! */}
          <Activity 
            className="h-5 w-5"
            style={{ color: 'var(--color-cream)' }}
          />
        </div>

        <div>
          <h1
            className="text-base font-semibold tracking-wide"
            style={{ color: 'var(--color-cream)' }}
          >
            PulmoScope
          </h1>

          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Lung Segmentation & Visualization
          </p>
        </div>
      </div>

      {/* Etiqueta de protótipo (oculta em telas muito pequenas) */}
      <span
        className="hidden rounded-md border px-3 py-1 text-[10px] uppercase tracking-wider sm:inline-flex"
        style={{
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
        }}
      >
        Uso didático · sem finalidade diagnóstica
      </span>
    </header>
  );
}