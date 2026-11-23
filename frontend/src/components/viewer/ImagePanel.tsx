/**
 * ImagePanel.tsx
 * Painel central do visualizador. Desenha no canvas a imagem original, a
 * máscara binária ou a sobreposição (máscara colorida sobre a imagem),
 * conforme a aba ativa. A máscara pode ser exibida preenchida ou só pelo
 * contorno, e a opacidade é ajustável no modo overlay.
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { LungFilterType, TabType } from '../../types/segmentation';
import { maskPixels } from '../../utils/mask';
import type { MaskStyle } from '../../utils/mask';

// Props
interface ImagePanelProps {
  // url blob da imagem carregada (null se não houver imagem)
  imagePreviewUrl: string | null;
  // url da máscara retornada pelo backend (ambos os pulmões)
  maskUrl: string | null;
  // máscaras de cada pulmão do paciente
  rightMaskUrl: string | null;
  leftMaskUrl: string | null;
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  // aba de visualização atual
  activeTab: TabType;
  // opacidade da máscara no overlay (0 a 100) e seu setter
  opacity: number;
  setOpacity: (value: number) => void;
  // pulmão exibido (ambos, direito ou esquerdo)
  selectedLung: LungFilterType;
  // máscara preenchida ou só o contorno, e seu setter
  maskStyle: MaskStyle;
  setMaskStyle: (value: MaskStyle) => void;
  // referência do canvas, criada no App
  canvasRef: RefObject<HTMLCanvasElement>;
}

export function ImagePanel({
  imagePreviewUrl,
  maskUrl,
  rightMaskUrl,
  leftMaskUrl,
  hasSegmented,
  activeTab,
  opacity,
  setOpacity,
  selectedLung,
  maskStyle,
  setMaskStyle,
  canvasRef,
}: ImagePanelProps) {
  
  // máscara exibida conforme o filtro de pulmão; a separação direito/esquerdo
  // vem do backend (convenção radiológica: o direito aparece à esquerda da imagem)
  const visibleMaskUrl =
    selectedLung === 'right' ? rightMaskUrl : selectedLung === 'left' ? leftMaskUrl : maskUrl;

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
      if (hasSegmented && visibleMaskUrl && activeTab !== 'original') {
        const maskImg = new Image();
        // necessário para ler os pixels (getImageData) de uma url de outra origem
        maskImg.crossOrigin = 'anonymous';
        maskImg.src = visibleMaskUrl;

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
          // pixels a pintar: a região inteira ou só a borda (modo contorno)
          const marked = maskPixels(data, canvas.width, canvas.height, maskStyle);

          // percorre os pixels (4 valores por pixel: R, G, B, A)
          for (let i = 0; i < data.length; i += 4) {
            const isMaskPixel = marked[i / 4] === 1;

            if (!isMaskPixel) {
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
            } else {
              // na aba máscara: branco (necessário no contorno, que vem do interior)
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = 255;
            }
          }

          tempCtx.putImageData(imgData, 0, 0);

          // a opacidade do slider só vale no overlay preenchido (o contorno é
          // fino e fica sempre opaco para continuar visível)
          ctx.globalAlpha = activeTab === 'overlay' && maskStyle === 'filled' ? opacity / 100 : 1;
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.globalAlpha = 1;
        };
      }
    };

    // cancela os desenhos pendentes quando o efeito é refeito ou desmontado
    return () => {
      cancelled = true;
    };
  }, [imagePreviewUrl, visibleMaskUrl, hasSegmented, activeTab, opacity, maskStyle, canvasRef]);

  return (
    <div
      className="flex flex-col rounded-xl border p-4 shadow-sm"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Área da imagem (canvas); border-border e bg-bg-base vêm das cores do tema (global.css).
          A altura acompanha a janela (descontando cabeçalho, título e controles),
          para o painel caber inteiro em telas baixas */}
      <div className="relative flex h-[clamp(16rem,calc(100vh-16rem),48rem)] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-bg-base">
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
            <canvas ref={canvasRef} className="h-full w-full object-contain" />
          </div>
        )}
      </div>

      {/* Controles da máscara (abas máscara e sobreposição, após segmentar) */}
      {imagePreviewUrl && hasSegmented && activeTab !== 'original' && (
        <div className="mt-3 flex items-center gap-4 border-t pt-3 text-xs" style={{ borderColor: 'var(--color-border)' }}>
          {/* preenchida × contorno */}
          <div
            className="flex shrink-0 overflow-hidden rounded-md border"
            style={{ borderColor: 'var(--color-border)' }}
            role="group"
            aria-label="Exibição da máscara"
          >
            {(
              [
                ['filled', 'Preenchida'],
                ['contour', 'Contorno'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={maskStyle === value}
                onClick={() => setMaskStyle(value)}
                className="px-2.5 py-1 transition hover:bg-white/5"
                style={
                  maskStyle === value
                    ? { backgroundColor: 'var(--color-olive-green)', color: 'var(--color-cream)' }
                    : { color: 'var(--color-text-muted)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* opacidade (só na sobreposição preenchida) */}
          {activeTab === 'overlay' && maskStyle === 'filled' && (
            <>
              <span style={{ color: 'var(--color-text-muted)' }}>Opacidade:</span>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}