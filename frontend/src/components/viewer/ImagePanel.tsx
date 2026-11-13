/**
 * ImagePanel.tsx
 * Painel central do visualizador. Desenha no canvas a imagem original, a
 * máscara binária ou a sobreposição (máscara colorida sobre a imagem),
 * conforme a aba ativa, e mostra o controle de opacidade no modo overlay.
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { LungFilterType, TabType } from '../../types/segmentation';

// Props
interface ImagePanelProps {
  // url blob da imagem carregada (null se não houver imagem)
  imagePreviewUrl: string | null;
  // url da máscara retornada pelo backend
  maskUrl: string | null;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  // aba de visualização atual
  activeTab: TabType;
  // opacidade da máscara no overlay (0 a 100) e seu setter
  opacity: number;
  setOpacity: (value: number) => void;
  // pulmão exibido (ambos, direito ou esquerdo)
  selectedLung: LungFilterType;
  // referência do canvas, criada no App
  canvasRef: RefObject<HTMLCanvasElement>;
}

export function ImagePanel({
  imagePreviewUrl,
  maskUrl,
  hasSegmented,
  activeTab,
  opacity,
  setOpacity,
  selectedLung,
  canvasRef,
}: ImagePanelProps) {
  
  // Renderização
  // redesenha o canvas sempre que imagem, máscara, aba, opacidade ou pulmão mudam
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagePreviewUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // evita desenhar com dados antigos se o efeito rodar de novo antes do load
    let cancelled = false;

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    baseImg.src = imagePreviewUrl;

    baseImg.onload = () => {
      if (cancelled) return;

      // o canvas assume o tamanho real da imagem
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. desenha a imagem base (original)
      ctx.globalAlpha = 1;
      ctx.drawImage(baseImg, 0, 0);

      // 2. nas abas de máscara e overlay, desenha o resultado da segmentação
      if (hasSegmented && maskUrl && activeTab !== 'original') {
        const maskImg = new Image();
        // necessário para ler os pixels (getImageData) de uma url de outra origem
        maskImg.crossOrigin = 'anonymous';
        maskImg.src = maskUrl;

        maskImg.onload = () => {
          if (cancelled) return;

          // canvas temporário para manipular os pixels da máscara
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) return;

          tempCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          // coluna central, usada para separar os dois pulmões
          const midX = canvas.width / 2;

          // percorre os pixels (4 valores por pixel: R, G, B, A)
          for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const x = pixelIndex % canvas.width;
            // máscara em tons de cinza: considera o canal vermelho
            const isMaskPixel = data[i] > 128;

            // filtro de pulmão (convenção radiológica: o pulmão direito do
            // paciente aparece no lado esquerdo da imagem)
            const hideRight = selectedLung === 'left' && x < midX;
            const hideLeft = selectedLung === 'right' && x >= midX;

            if (!isMaskPixel || hideRight || hideLeft) {
              if (activeTab === 'mask') {
                // fora da máscara: preto opaco
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 255;
              } else {
                // fora da máscara no overlay: transparente
                data[i + 3] = 0;
              }
            } else if (activeTab === 'overlay') {
              // cor de destaque da máscara (verde #84cc16)
              data[i] = 132;
              data[i + 1] = 204;
              data[i + 2] = 22;
              data[i + 3] = 255;
            }
          }

          tempCtx.putImageData(imgData, 0, 0);

          // a opacidade do slider só vale no overlay
          ctx.globalAlpha = activeTab === 'overlay' ? opacity / 100 : 1;
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.globalAlpha = 1;
        };
      }
    };

    // cancela os desenhos pendentes quando o efeito é refeito ou desmontado
    return () => {
      cancelled = true;
    };
  }, [imagePreviewUrl, maskUrl, hasSegmented, activeTab, opacity, selectedLung, canvasRef]);

  return (
    <div
      className="flex flex-col rounded-xl border p-4 shadow-sm"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Área da imagem (canvas); border-border e bg-bg-base vêm das cores do tema (global.css) */}
      <div className="relative flex h-120 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-bg-base">
        {!imagePreviewUrl ? (
          // estado vazio
          <div className="text-center">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Nenhuma imagem selecionada
            </p>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Faça o upload na barra lateral para começar!
            </p>
          </div>
        ) : (
          <div className="relative flex h-full w-full items-center justify-center">
            {/* o mesmo canvas exibe as 3 abas (original, máscara e overlay) */}
            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>

      {/* Controle de opacidade (só na aba de sobreposição, com imagem carregada) */}
      {imagePreviewUrl && activeTab === 'overlay' && (
        <div className="mt-3 flex items-center gap-4 border-t pt-3 text-xs" style={{ borderColor: 'var(--color-border)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Opacidade da máscara:</span>
          <input
            type="range"
            aria-label="Opacidade da máscara"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="slider flex-1"
          />
          <span className="font-mono">{opacity}%</span>
        </div>
      )}
    </div>
  );
}