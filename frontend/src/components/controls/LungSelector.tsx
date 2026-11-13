/**
 * LungSelector.tsx
 * Lista de seleção da região pulmonar exibida (ambos, direito ou esquerdo).
 * O estado fica no App, aqui só se exibe e se notifica a troca.
 */

import type { LungFilterType } from '../../types/segmentation';

// Props
interface LungSelectorProps {
  // pulmão selecionado e seu setter
  selectedLung: LungFilterType;
  setSelectedLung: (value: LungFilterType) => void;
}

export function LungSelector({
  selectedLung,
  setSelectedLung,
}: LungSelectorProps) {
  return (
    <section className="space-y-3">
      <label
        htmlFor="lung-selector"
        className="block text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        3. Região Pulmonar
      </label>

      <select
        id="lung-selector"
        value={selectedLung}
        // os valores das opções correspondem ao tipo LungFilterType
        onChange={(event) =>
          setSelectedLung(event.target.value as LungFilterType)
        }
        className="w-full cursor-pointer rounded-lg border px-3 py-2.5 text-xs font-medium transition outline-none"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-cream)',
        }}
      >
        <option value="both">Ambos os pulmões</option>
        <option value="right">Pulmão direito</option>
        <option value="left">Pulmão esquerdo</option>
      </select>
    </section>
  );
}