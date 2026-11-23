/**
 * mask.ts
 * Utilitários da máscara binária usados no visualizador e na exportação:
 * leitura dos pixels marcados e extração do contorno.
 */

// modo de exibição da máscara
export type MaskStyle = 'filled' | 'contour';

// espessura do contorno: 1 px em 512×512, proporcional em imagens maiores
export function contourThickness(width: number): number {
  return Math.max(1, Math.round(width / 512));
}

/**
 * Recebe os pixels RGBA da máscara (getImageData) e devolve um mapa com 1 nos
 * pixels a pintar. No modo contorno, só fica a borda interna de cada região:
 * pixels da máscara com algum vizinho (até `thickness` px na horizontal ou
 * vertical) fora dela. A borda fica dentro da região, preservando o contorno.
 */
export function maskPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  style: MaskStyle,
): Uint8Array {
  const inside = new Uint8Array(width * height);
  for (let p = 0; p < inside.length; p++) {
    // máscara em tons de cinza: considera o canal vermelho
    inside[p] = data[p * 4] > 128 ? 1 : 0;
  }
  if (style === 'filled') return inside;

  const t = contourThickness(width);
  const out = new Uint8Array(width * height);
  // fora da imagem conta como fora da máscara
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height ? inside[y * width + x] : 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside[y * width + x]) continue;
      for (let d = 1; d <= t; d++) {
        if (!at(x - d, y) || !at(x + d, y) || !at(x, y - d) || !at(x, y + d)) {
          out[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return out;
}
