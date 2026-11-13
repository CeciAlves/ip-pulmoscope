/**
 * api.ts
 * Camada de comunicação com o backend FastAPI. Centraliza as chamadas HTTP
 * para que hooks e componentes não precisem conhecer a URL nem o formato
 * da requisição.
 */

import type { EngineType, Metrics } from '../types/segmentation';

// Tipos
// resposta do endpoint de segmentação
export interface SegmentationResponse {
  // indica se o backend concluiu o processamento
  success: boolean;
  // motor que realmente processou a imagem
  engine: EngineType;
  // áreas e tempos medidos no backend
  metrics: Metrics;
  // url da máscara binária gerada
  mask_url: string;
}

// Requisições
// envia a imagem ao backend e retorna a máscara e as métricas da segmentação
export async function segmentImageApi(
  imageFileOrBlob: Blob,
  threshold: number,
  engine: EngineType,
): Promise<SegmentationResponse> {
  const extension = imageFileOrBlob.type === 'image/jpeg' ? 'jpg' : 'png';

  // o backend espera multipart/form-data
  const formData = new FormData();
  formData.append('file', imageFileOrBlob, `image.${extension}`);
  formData.append('threshold', threshold.toString());
  formData.append('engine', engine);

  // url fixa para desenvolvimento local
  const response = await fetch('http://localhost:8000/api/v1/segment', {
    method: 'POST',
    body: formData,
  });

  // qualquer status fora de 2xx vira erro, tratado pelo hook de segmentação!
  if (!response.ok) {
    throw new Error('Falha ao processar a segmentação no servidor.');
  }

  const data = await response.json();
  return data;
}