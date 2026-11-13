/**
 * Sidebar.tsx
 * Barra lateral de controles. Reúne upload de imagem, limiar, seleção de
 * pulmão e de engine, além do botão que dispara a segmentação.
 * Não guarda estado: tudo vem do App por props.
 */

import { Activity, RefreshCw } from 'lucide-react';
import type { EngineType, LungFilterType } from '../../types/segmentation';

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
  // limiar da segmentação e seu setter
  threshold: number;
  setThreshold: (value: number) => void;
  // pulmão exibido e seu setter
  selectedLung: LungFilterType;
  setSelectedLung: (value: LungFilterType) => void;
  // motor de processamento e seu setter
  engine: EngineType;
  setEngine: (value: EngineType) => void;
  // callbacks de ação do usuário
  onImageSelected: (file: File) => void;
  onLoadSample: () => void | Promise<void>;
  onRemoveImage: () => void;
  onRunSegmentation: () => void;
}

export function Sidebar({
  imageName,
  hasImage,
  isProcessing,
  errorMessage,
  threshold,
  setThreshold,
  selectedLung,
  setSelectedLung,
  engine,
  setEngine,
  onImageSelected,
  onLoadSample,
  onRemoveImage,
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
          onImageSelected={onImageSelected}
          onLoadSample={onLoadSample}
          onRemoveImage={onRemoveImage}
        />

        <ThresholdControl
          threshold={threshold}
          setThreshold={setThreshold}
        />

        <LungSelector
          selectedLung={selectedLung}
          setSelectedLung={setSelectedLung}
        />

        <EngineSelector engine={engine} setEngine={setEngine} />
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