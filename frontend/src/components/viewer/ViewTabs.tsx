/**
 * ViewTabs.tsx
 * Abas de visualização (original, máscara binária e sobreposição).
 * As abas de resultado ficam desabilitadas até a segmentação ser concluída.
 */

import type { TabType } from '../../types/segmentation';

// Constantes
// abas exibidas, na ordem de apresentação
const TABS: { id: TabType; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'mask', label: 'Máscara Binária' },
  { id: 'overlay', label: 'Sobreposição' },
];

// Props
interface ViewTabsProps {
  // aba ativa e seu setter
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
}

export function ViewTabs({
  activeTab,
  setActiveTab,
  hasSegmented,
}: ViewTabsProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border p-1"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        // só a aba original está liberada antes da segmentação
        const isDisabled = tab.id !== 'original' && !hasSegmented;

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            disabled={isDisabled}
            onClick={() => setActiveTab(tab.id)}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: isActive
                ? 'var(--color-olive-green)'
                : 'transparent',
              color: isActive ? 'var(--color-cream)' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}