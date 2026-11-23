/**
 * api.ts
 * Camada de comunicação com o backend FastAPI. Centraliza as chamadas HTTP
 * para que hooks e componentes não precisem conhecer a URL nem o formato
 * da requisição.
 */

import type { EngineType, Metrics, SegmentationOptions } from '../types/segmentation';

// url do backend (pode ser trocada com VITE_API_URL no .env)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

// Tipos
// resposta do endpoint de segmentação
export interface SegmentationResponse {
  // indica se o backend concluiu o processamento
  success: boolean;
  // motor que realmente processou a imagem
  engine: EngineType;
  // áreas e tempos medidos no backend
  metrics: Metrics;
  // limiar efetivamente usado (o calculado por Otsu, se automático)
  threshold: number;
  // dimensões da imagem processada
  width: number;
  height: number;
  // url da máscara binária gerada (ambos os pulmões)
  mask_url: string;
  // máscaras separadas por pulmão do paciente
  right_mask_url: string;
  left_mask_url: string;
  // avisos do processamento (ex.: GPU indisponível, imagem fora do padrão)
  warnings: string[];
}

// erro com mensagem vinda do servidor (diferente de falha de conexão)
export class ApiError extends Error {}

// consulta se o servidor tem GPU utilizável
export async function getCapabilitiesApi(): Promise<{ gpu: boolean }> {
  const response = await fetch(`${API_URL}/capabilities`);
  if (!response.ok) throw new Error('Falha ao consultar o servidor.');
  return response.json();
}

// Requisições
// envia a imagem ao backend e retorna a máscara e as métricas da segmentação
export async function segmentImageApi(
  imageFileOrBlob: Blob,
  options: SegmentationOptions,
  // máscara de referência opcional, para o backend calcular Dice e IoU
  groundTruth: Blob | null = null,
): Promise<SegmentationResponse> {
  const extension = imageFileOrBlob.type === 'image/jpeg' ? 'jpg' : 'png';

  // o backend espera multipart/form-data
  const formData = new FormData();
  formData.append('file', imageFileOrBlob, `image.${extension}`);
  formData.append('threshold', options.threshold.toString());
  formData.append('engine', options.engine);
  formData.append('auto_threshold', String(options.autoThreshold));
  formData.append('fill_holes', String(options.fillHoles));
  if (groundTruth) formData.append('ground_truth', groundTruth, 'referencia.png');

  const response = await fetch(`${API_URL}/segment`, {
    method: 'POST',
    body: formData,
  });

  // qualquer status fora de 2xx vira erro, tratado pelo hook de segmentação!
  // o FastAPI devolve a mensagem em "detail"
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.detail ?? 'Falha ao processar a segmentação no servidor.');
  }

  const data = await response.json();
  return data;
}