/**
 * SampleGallery.tsx
 * Galeria de cortes de exemplo embutidos (pasta public/amostras). Os cortes do
 * LUNA16 vêm com a máscara de referência, então o Dice e o IoU aparecem
 * automaticamente após a segmentação. Inclui casos fáceis e casos em que o
 * método falha, para discussão.
 */

// Tipos
export interface Sample {
  id: string;
  // rótulo curto exibido sob a miniatura
  label: string;
  // explicação exibida ao passar o mouse
  description: string;
  imageUrl: string;
  // máscara de referência (null quando não há)
  maskUrl: string | null;
  // nome de arquivo usado na interface e nas exportações
  fileName: string;
}

// Amostras
function luna16(id: string, label: string, description: string): Sample {
  return {
    id,
    label,
    description,
    imageUrl: `/amostras/${id}.png`,
    maskUrl: `/amostras/${id}_mascara.png`,
    fileName: `luna16_${id}.png`,
  };
}

export const SAMPLES: Sample[] = [
  {
    id: 'exemplo',
    label: 'Exemplo',
    description: 'Corte de demonstração (1024×1024, sem máscara de referência).',
    imageUrl: '/image-example.png',
    maskUrl: null,
    fileName: 'image-example.png',
  },
  luna16('apice', 'Ápice', 'LUNA16: topo dos pulmões, regiões pequenas.'),
  luna16('meio', 'Meio', 'LUNA16: região média, os dois pulmões bem separados.'),
  luna16('nodulo', 'Nódulo', 'LUNA16: corte que passa por um nódulo anotado de 11,6 mm.'),
  luna16('base', 'Base', 'LUNA16: base dos pulmões, ao lado do fígado e do estômago.'),
  luna16(
    'gas_estomago',
    'Falha: gás',
    'LUNA16: o gás do estômago é escuro como o pulmão e é escolhido no lugar do pulmão direito.'
  ),
  luna16(
    'mesa',
    'Falha: mesa',
    'LUNA16: o ar entre o paciente e a mesa do tomógrafo não toca a borda e entra na máscara.'
  ),
];

// Props
interface SampleGalleryProps {
  // nome do arquivo carregado (destaca a amostra ativa)
  imageName: string;
  onSelect: (sample: Sample) => void | Promise<void>;
}

export function SampleGallery({ imageName, onSelect }: SampleGalleryProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
        Ou escolha um corte de exemplo:
      </p>

      <div className="grid grid-cols-4 gap-1.5">
        {SAMPLES.map((sample) => {
          const active = imageName === sample.fileName;
          return (
            <button
              key={sample.id}
              type="button"
              title={sample.description}
              onClick={() => onSelect(sample)}
              className="overflow-hidden rounded-md border text-center transition hover:brightness-125"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                borderColor: active ? 'var(--color-olive-green)' : 'var(--color-border)',
              }}
            >
              <img
                src={sample.imageUrl}
                alt={sample.label}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <span className="block truncate px-0.5 py-0.5 text-[9px]">{sample.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
