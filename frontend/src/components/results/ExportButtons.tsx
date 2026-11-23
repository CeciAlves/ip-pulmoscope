/**
 * ExportButtons.tsx
 * Cartão com os botões de exportação do resultado: máscara binária (PNG),
 * sobreposição na imagem original (PNG) e métricas (CSV). Habilitados
 * somente após a segmentação. Respeitam o filtro de pulmão selecionado e o
 * modo de exibição (preenchida ou contorno).
 */

import { Download, FileSpreadsheet, Layers } from 'lucide-react';
import type { EngineType, LungFilterType, Metrics } from '../../types/segmentation';
import { maskPixels } from '../../utils/mask';
import type { MaskStyle } from '../../utils/mask';

// Tipos
// dados necessários para gerar os arquivos
export interface ExportData {
  imageName: string;
  imagePreviewUrl: string | null;
  // máscara visível (ambos, direito ou esquerdo, conforme o filtro)
  maskUrl: string | null;
  metrics: Metrics;
  selectedLung: LungFilterType;
  thresholdUsed: number | null;
  autoThreshold: boolean;
  fillHoles: boolean;
  engineRequested: EngineType;
  engineUsed: EngineType | null;
  // opacidade da máscara na sobreposição (0 a 100)
  opacity: number;
  // máscara preenchida ou só o contorno
  maskStyle: MaskStyle;
}

// Props
interface ExportButtonsProps {
  // true quando já existe resultado de segmentação
  hasSegmented: boolean;
  data: ExportData;
}

// Utilitários
// sufixo dos arquivos conforme o filtro de pulmão
const LUNG_SUFFIX: Record<LungFilterType, string> = {
  both: 'ambos',
  right: 'direito',
  left: 'esquerdo',
};

// nome base do arquivo, sem extensão
function baseName(name: string): string {
  return (name || 'imagem').replace(/\.[^.]+$/, '');
}

// dispara o download de uma url (data url ou blob)
function downloadUrl(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// carrega uma imagem a partir de uma url
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// lê os pixels da máscara no tamanho dado e marca os que devem ser pintados
function readMask(mask: HTMLImageElement, width: number, height: number, style: MaskStyle) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(mask, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  return { canvas, ctx, pixels, marked: maskPixels(pixels.data, width, height, style) };
}

// máscara binária (branco = região) no modo pedido, em PNG
async function buildMaskPng(maskUrl: string, style: MaskStyle) {
  const mask = await loadImage(maskUrl);
  const { canvas, ctx, pixels, marked } = readMask(mask, mask.width, mask.height, style);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = marked[i / 4] ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

// desenha a máscara (verde) sobre a imagem original e devolve um PNG
async function buildOverlayPng(imageUrl: string, maskUrl: string, opacity: number, style: MaskStyle) {
  const [base, mask] = await Promise.all([loadImage(imageUrl), loadImage(maskUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');

  ctx.drawImage(base, 0, 0);

  // pinta de verde só os pixels marcados (o resto fica transparente)
  const { canvas: layer, ctx: layerCtx, pixels, marked } = readMask(
    mask,
    canvas.width,
    canvas.height,
    style
  );
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const inside = marked[i / 4] === 1;
    d[i] = 132;
    d[i + 1] = 204;
    d[i + 2] = 22;
    d[i + 3] = inside ? 255 : 0;
  }
  layerCtx.putImageData(pixels, 0, 0);

  // contorno sempre opaco, como na tela
  ctx.globalAlpha = style === 'contour' ? 1 : opacity / 100;
  ctx.drawImage(layer, 0, 0);
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

// monta o CSV (separador vírgula, decimais com ponto)
function buildCsv(data: ExportData): string {
  const m = data.metrics;
  const rows: [string, string | number][] = [
    ['arquivo', data.imageName],
    ['pulmao_exibido', LUNG_SUFFIX[data.selectedLung]],
    ['limiar', data.thresholdUsed ?? ''],
    ['limiar_automatico_otsu', data.autoThreshold ? 'sim' : 'nao'],
    ['preencher_buracos', data.fillHoles ? 'sim' : 'nao'],
    ['motor_solicitado', data.engineRequested],
    ['motor_usado', data.engineUsed ?? ''],
    ['area_pulmao_direito_px', m.rightArea],
    ['area_pulmao_esquerdo_px', m.leftArea],
    ['area_total_px', m.totalArea],
    ['tempo_limiarizacao_ms', m.kernelTime],
    ['tempo_copia_cpu_gpu_ms', m.transferTime],
    ['tempo_total_ms', m.totalTime],
    ['dice', m.dice ?? ''],
    ['iou', m.iou ?? ''],
  ];
  // aspas em valores com vírgula ou aspas (ex.: nome do arquivo)
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = rows.map(([key]) => key).join(',');
  const values = rows.map(([, value]) => escape(value)).join(',');
  return `${header}\n${values}\n`;
}

export function ExportButtons({ hasSegmented, data }: ExportButtonsProps) {
  const name = `${baseName(data.imageName)}_${LUNG_SUFFIX[data.selectedLung]}`;
  const styleSuffix = data.maskStyle === 'contour' ? 'contorno' : 'mascara';

  // Handlers
  async function handleDownloadMask() {
    if (!data.maskUrl) return;
    try {
      // preenchida: a própria máscara do backend; contorno: gerada aqui
      const png =
        data.maskStyle === 'contour' ? await buildMaskPng(data.maskUrl, 'contour') : data.maskUrl;
      downloadUrl(png, `${name}_${styleSuffix}.png`);
    } catch (error) {
      console.error('Erro ao gerar a máscara:', error);
    }
  }

  async function handleDownloadOverlay() {
    if (!data.imagePreviewUrl || !data.maskUrl) return;
    try {
      const png = await buildOverlayPng(
        data.imagePreviewUrl,
        data.maskUrl,
        data.opacity,
        data.maskStyle
      );
      downloadUrl(png, `${name}_sobreposicao_${styleSuffix}.png`);
    } catch (error) {
      console.error('Erro ao gerar a sobreposição:', error);
    }
  }

  function handleExportCsv() {
    // BOM para o Excel reconhecer UTF-8
    const blob = new Blob(['﻿' + buildCsv(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `${baseName(data.imageName)}_metricas.csv`);
    URL.revokeObjectURL(url);
  }

  const buttons = [
    { label: 'Baixar Máscara (PNG)', icon: Download, onClick: handleDownloadMask },
    { label: 'Baixar Sobreposição (PNG)', icon: Layers, onClick: handleDownloadOverlay },
    { label: 'Exportar Métricas (CSV)', icon: FileSpreadsheet, onClick: handleExportCsv },
  ];

  return (
    <div
      className="flex flex-col justify-between rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
      }}
    >
      <h3
        className="mb-3 text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Exportar Resultados
      </h3>

      <div className="space-y-2.5">
        {buttons.map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            disabled={!hasSegmented}
            onClick={onClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border)',
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-olive-green)' }} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
