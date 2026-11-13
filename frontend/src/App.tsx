/**
 * App.tsx
 * Componente raiz do PulmoScope. Guarda o estado compartilhado da interface
 * (aba, opacidade, limiar, pulmão e engine) e liga os hooks de upload e
 * segmentação aos componentes de cada região da tela.
 *
 * Layout em 3 colunas: Sidebar (controles) | Visualizador | Painel de métricas.
 */

import { useRef, useState } from 'react';

// Layout e painéis
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ResultsPanel } from './components/results/ResultsPanel';
import { ImagePanel } from './components/viewer/ImagePanel';
import { ViewTabs } from './components/viewer/ViewTabs';

// Tipos
import type { EngineType, LungFilterType, TabType } from './types/segmentation';

// Hooks (lógica de upload e de segmentação)
import { useImageUpload } from './hooks/useImageUpload';
import { useSegmentation } from './hooks/useSegmentation';

export default function App() {

  // Estado da interface | Setup
  const [activeTab, setActiveTab] = useState<TabType>('original'); 
  const [opacity, setOpacity] = useState(45);                    
  const [threshold, setThreshold] = useState(120);           
  const [selectedLung, setSelectedLung] = useState<LungFilterType>('both'); 
  const [engine, setEngine] = useState<EngineType>('gpu');       

  // Referência do canvas, repassada ao ImagePanel
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Hooks customizados
  // upload: controla a imagem carregada, o nome e mensagens de erro
  const {
    imagePreviewUrl,
    imageName,
    errorMessage,
    hasImage,
    handleImageSelection,
    handleLoadSample,
    handleRemoveImage,
    setErrorMessage,
  } = useImageUpload();

  // segmentação: chama o backend e guarda máscara e métricas
  const {
    isProcessing,
    hasSegmented,
    metrics,
    maskUrl,
    runSegmentation,
    resetSegmentation,
  } = useSegmentation();

  // Handlers
  // remove a imagem e limpa o resultado, voltando para a aba original
  function onRemove() {
    handleRemoveImage();
    resetSegmentation();
    setActiveTab('original');
  }

  // dispara a segmentação; ao terminar com sucesso, abre a aba de sobreposição
  function handleRun() {
    runSegmentation(
      imagePreviewUrl,
      threshold,
      engine,
      (msg) => setErrorMessage(msg), // em caso de erro
      () => setActiveTab('overlay')  // em caso de sucesso
    );
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-panel-subtle)',
        color: 'var(--color-cream)',
      }}
    >
      <Header />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Coluna 1: controles (upload, limiar, pulmão, engine e ações) */}
        <Sidebar
          imageName={imageName}
          hasImage={hasImage}
          isProcessing={isProcessing}
          errorMessage={errorMessage}
          threshold={threshold}
          setThreshold={setThreshold}
          selectedLung={selectedLung}
          setSelectedLung={setSelectedLung}
          engine={engine}
          setEngine={setEngine}
          // nova imagem: descarta o resultado anterior e volta à aba original
          onImageSelected={(file) => {
            handleImageSelection(file);
            resetSegmentation();
            setActiveTab('original');
          }}
          // carrega a imagem de exemplo (assíncrono) e reinicia o resultado
          onLoadSample={async () => {
            await handleLoadSample();
            resetSegmentation();
            setActiveTab('original');
          }}
          onRemoveImage={() => {
            onRemove();
          }}
          onRunSegmentation={handleRun}
        />

        {/* Coluna 2: visualizador da imagem */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Visualização da Imagem</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Análise e visualização da segmentação pulmonar
              </p>
            </div>

            {/* alterna entre as visões (original, sobreposição etc.) */}
            <ViewTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasSegmented={hasSegmented}
            />
          </div>

          <ImagePanel
            imagePreviewUrl={imagePreviewUrl}
            maskUrl={maskUrl}
            hasSegmented={hasSegmented}
            activeTab={activeTab}
            opacity={opacity}
            setOpacity={setOpacity}
            selectedLung={selectedLung}
            canvasRef={canvasRef}
          />

          {/* Aviso: o projeto é acadêmico e não serve para diagnóstico */}
          <p className="pb-2 text-center text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            PulmoScope é um protótipo educacional para estudo de processamento de imagens médicas. Não possui finalidade diagnóstica.
          </p>
        </div>

        {/* Coluna 3: métricas e exportação dos resultados */}
        <div className="w-95 shrink-0 overflow-y-auto border-l p-6 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-panel-subtle, #0d0e11)' }}>
          <div>
            <h2 className="text-base font-semibold">Métricas e Exportação</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Resultados detalhados da segmentação
            </p>
          </div>

          <ResultsPanel
            metrics={metrics}
            hasSegmented={hasSegmented}
            engine={engine}
          />
        </div>
      </main>
    </div>
  );
}