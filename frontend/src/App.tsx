/**
 * App.tsx
 * Componente raiz do PulmoScope. Guarda o estado compartilhado da interface
 * (aba, opacidade, limiar, pulmão e engine) e liga os hooks de upload e
 * segmentação aos componentes de cada região da tela.
 *
 * Layout em 3 colunas: Sidebar (controles) | Visualizador | Painel de métricas.
 */

import { useEffect, useRef, useState } from 'react';

// Layout e painéis
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ResultsPanel } from './components/results/ResultsPanel';
import { ImagePanel } from './components/viewer/ImagePanel';
import { ViewTabs } from './components/viewer/ViewTabs';

// API
import { getCapabilitiesApi } from './services/api';

// Tipos
import type { EngineType, LungFilterType, TabType } from './types/segmentation';
import type { MaskStyle } from './utils/mask';

// Hooks (lógica de upload e de segmentação)
import { useImageUpload } from './hooks/useImageUpload';
import { useSegmentation } from './hooks/useSegmentation';

export default function App() {

  // Estado da interface | Setup
  const [activeTab, setActiveTab] = useState<TabType>('original'); 
  const [opacity, setOpacity] = useState(45);
  // máscara exibida preenchida ou só pelo contorno
  const [maskStyle, setMaskStyle] = useState<MaskStyle>('filled');                    
  const [threshold, setThreshold] = useState(120);           
  const [selectedLung, setSelectedLung] = useState<LungFilterType>('both'); 
  const [engine, setEngine] = useState<EngineType>('gpu');       
  const [autoThreshold, setAutoThreshold] = useState(false);
  const [fillHoles, setFillHoles] = useState(true);
  // null enquanto o servidor não foi consultado
  const [gpuAvailable, setGpuAvailable] = useState<boolean | null>(null);
  // máscara de referência opcional (habilita Dice e IoU)
  const [groundTruth, setGroundTruth] = useState<File | null>(null);

  // Referência do canvas, repassada ao ImagePanel
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Hooks customizados
  // upload: controla a imagem carregada, o nome e mensagens de erro
  const {
    imagePreviewUrl,
    imageName,
    errorMessage,
    inputWarning,
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
    rightMaskUrl,
    leftMaskUrl,
    engineUsed,
    thresholdUsed,
    warnings,
    runSegmentation,
    resetSegmentation,
  } = useSegmentation();

  // Handlers
  // remove a imagem e limpa o resultado, voltando para a aba original
  function onRemove() {
    handleRemoveImage();
    setGroundTruth(null);
    resetSegmentation();
    setActiveTab('original');
  }

  // consulta uma vez se o servidor tem GPU (o seletor avisa se não tiver)
  useEffect(() => {
    getCapabilitiesApi()
      .then((caps) => setGpuAvailable(caps.gpu))
      .catch(() => setGpuAvailable(null));
  }, []);

  // dispara a segmentação; ao terminar com sucesso, abre a aba de sobreposição
  function handleRun() {
    setErrorMessage('');
    runSegmentation(
      imagePreviewUrl,
      { threshold, autoThreshold, fillHoles, engine },
      groundTruth,
      (msg) => setErrorMessage(msg), // em caso de erro
      () => setActiveTab((tab) => (tab === 'original' ? 'overlay' : tab)) // em caso de sucesso
    );
  }

  // depois da primeira segmentação, mudar limiar/opções re-segmenta sozinho,
  // com debounce para não disparar uma requisição a cada passo do slider
  useEffect(() => {
    if (!hasSegmented) return;
    const timer = setTimeout(() => {
      runSegmentation(
        imagePreviewUrl,
        { threshold, autoThreshold, fillHoles, engine },
        groundTruth,
        (msg) => setErrorMessage(msg),
        () => setErrorMessage('')
      );
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, autoThreshold, fillHoles, engine, groundTruth]);

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
          inputWarning={inputWarning}
          threshold={threshold}
          setThreshold={setThreshold}
          autoThreshold={autoThreshold}
          setAutoThreshold={setAutoThreshold}
          thresholdUsed={thresholdUsed}
          fillHoles={fillHoles}
          setFillHoles={setFillHoles}
          selectedLung={selectedLung}
          setSelectedLung={setSelectedLung}
          engine={engine}
          setEngine={setEngine}
          gpuAvailable={gpuAvailable}
          // nova imagem: descarta o resultado anterior e volta à aba original
          onImageSelected={async (file) => {
            // só descarta o resultado anterior se a nova imagem for aceita
            if (await handleImageSelection(file)) {
              // a referência pertence à imagem anterior
              setGroundTruth(null);
              resetSegmentation();
              setActiveTab('original');
            }
          }}
          // carrega um corte da galeria e, se houver, a máscara de referência dele
          onLoadSample={async (sample) => {
            if (!(await handleLoadSample(sample.imageUrl, sample.fileName))) return;
            resetSegmentation();
            setActiveTab('original');
            let reference: File | null = null;
            if (sample.maskUrl) {
              try {
                const blob = await (await fetch(sample.maskUrl)).blob();
                reference = new File([blob], sample.maskUrl.split('/').pop()!, { type: 'image/png' });
              } catch {
                // sem a referência, a amostra funciona normalmente (só sem Dice/IoU)
              }
            }
            setGroundTruth(reference);
          }}
          onRemoveImage={() => {
            onRemove();
          }}
          groundTruthName={groundTruth?.name ?? null}
          onGroundTruthSelected={(file) => {
            if (file.type !== 'image/png') {
              setErrorMessage('A máscara de referência deve ser um PNG.');
              return;
            }
            setErrorMessage('');
            setGroundTruth(file);
          }}
          onRemoveGroundTruth={() => setGroundTruth(null)}
          onRunSegmentation={handleRun}
        />

        {/* Colunas 2 e 3. Em telas largas (xl, 1280 px) ficam lado a lado, cada uma
            com rolagem própria; em telas estreitas ou com zoom, as métricas descem
            para baixo do visualizador e a área inteira rola junta */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
          {/* Coluna 2: visualizador da imagem */}
          <div className="flex min-w-0 flex-col p-6 space-y-4 xl:flex-1 xl:overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
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
              rightMaskUrl={rightMaskUrl}
              leftMaskUrl={leftMaskUrl}
              hasSegmented={hasSegmented}
              activeTab={activeTab}
              opacity={opacity}
              setOpacity={setOpacity}
              selectedLung={selectedLung}
              maskStyle={maskStyle}
              setMaskStyle={setMaskStyle}
              canvasRef={canvasRef}
            />

            {/* Aviso: o projeto é acadêmico e não serve para diagnóstico */}
            <p className="pb-2 text-center text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              PulmoScope é um protótipo educacional para estudo de processamento de imagens médicas. Não possui finalidade diagnóstica.
            </p>
          </div>

          {/* Coluna 3: métricas e exportação dos resultados */}
          <div className="w-full shrink-0 border-t p-6 space-y-4 xl:w-80 2xl:w-95 xl:overflow-y-auto xl:border-t-0 xl:border-l" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-panel-subtle, #0d0e11)' }}>
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
              engineUsed={engineUsed}
              warnings={warnings}
              exportData={{
                imageName,
                imagePreviewUrl,
                maskUrl:
                  selectedLung === 'right'
                    ? rightMaskUrl
                    : selectedLung === 'left'
                      ? leftMaskUrl
                      : maskUrl,
                metrics,
                selectedLung,
                thresholdUsed,
                autoThreshold,
                fillHoles,
                engineRequested: engine,
                engineUsed,
                opacity,
                maskStyle,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}