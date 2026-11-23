/**
 * Sidebar.tsx
 * Barra lateral de controles. Reúne upload de imagem, limiar, seleção de
 * pulmão e de engine, além do botão que dispara a segmentação.
 * Não guarda estado: tudo vem do App por props.
 */

import { Activity, RefreshCw } from 'lucide-react';
import type { EngineType, LungFilterType } from '../../types/segmentation';
import type { Sample } from '../controls/SampleGallery';

// Controles
import { EngineSelector } from '../controls/EngineSelector';
import { ImageUpload } from '../controls/ImageUpload';
import { LungSelector } from '../controls/LungSelector';
import { ThresholdControl } from '../controls/ThresholdControl';

// Props
interface SidebarProps {
  // nome do arquivo carregado
  imageName: string;
  // true quando há imagem carregada
  hasImage: boolean;
  // true enquanto o backend processa
  isProcessing: boolean;
  // mensagem de erro exibida no upload
  errorMessage: string;
  // aviso não bloqueante sobre a imagem de entrada
  inputWarning: string;
  // limiar da segmentação e seu setter
  threshold: number;
  setThreshold: (value: number) => void;
  // limiar automático (Otsu), limiar calculado e preenchimento de buracos
  autoThreshold: boolean;
  setAutoThreshold: (value: boolean) => void;
  thresholdUsed: number | null;
  fillHoles: boolean;
  setFillHoles: (value: boolean) => void;
  // pulmão exibido e seu setter
  selectedLung: LungFilterType;
  setSelectedLung: (value: LungFilterType) => void;
  // motor de processamento e seu setter
  engine: EngineType;
  setEngine: (value: EngineType) => void;
  // false quando o servidor informa que não há GPU (null = ainda não consultado)
  gpuAvailable: boolean | null;
  // callbacks de ação do usuário
  onImageSelected: (file: File) => void;
  onLoadSample: (sample: Sample) => void | Promise<void>;
  onRemoveImage: () => void;
  // máscara de referência opcional (Dice e IoU)
  groundTruthName: string | null;
  onGroundTruthSelected: (file: File) => void;
  onRemoveGroundTruth: () => void;
  onRunSegmentation: () => void;
}

export function Sidebar({
  imageName,
  hasImage,
  isProcessing,
  errorMessage,
  inputWarning,
  threshold,
  setThreshold,
  autoThreshold,
  setAutoThreshold,
  thresholdUsed,
  fillHoles,
  setFillHoles,
  selectedLung,
  setSelectedLung,
  engine,
  setEngine,
  gpuAvailable,
  onImageSelected,
  onLoadSample,
  onRemoveImage,
  groundTruthName,
  onGroundTruthSelected,
  onRemoveGroundTruth,
  onRunSegmentation,
}: SidebarProps) {
  return (
    <aside
      className="flex w-76 shrink-0 flex-col justify-between overflow-y-auto border-r p-5"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Parte superior: controles de configuração */}
      <div className="space-y-6">
        <ImageUpload
          imageName={imageName}
          hasImage={hasImage}
          errorMessage={errorMessage}
          inputWarning={inputWarning}
          onImageSelected={onImageSelected}
          onLoadSample={onLoadSample}
          onRemoveImage={onRemoveImage}
          groundTruthName={groundTruthName}
          onGroundTruthSelected={onGroundTruthSelected}
          onRemoveGroundTruth={onRemoveGroundTruth}
        />

        <ThresholdControl
          threshold={threshold}
          setThreshold={setThreshold}
          autoThreshold={autoThreshold}
          setAutoThreshold={setAutoThreshold}
          thresholdUsed={thresholdUsed}
          fillHoles={fillHoles}
          setFillHoles={setFillHoles}
        />

        <LungSelector
          selectedLung={selectedLung}
          setSelectedLung={setSelectedLung}
        />

        <EngineSelector
          engine={engine}
          setEngine={setEngine}
          gpuAvailable={gpuAvailable}
        />
      </div>

      {/* Parte inferior: botão de segmentação */}
      <div className="pt-6">
        {/* desabilitado sem imagem ou durante o processamento */}
        <button
          type="button"
          onClick={onRunSegmentation}
          disabled={!hasImage || isProcessing}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: 'var(--color-olive-green)',
            color: 'var(--color-cream)',
          }}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4" />
              Segmentar Imagem
            </>
          )}
        </button>
      </div>
    </aside>
  );
}