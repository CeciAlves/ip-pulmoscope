/**
 * useSegmentation.ts
 * Hook que gerencia o fluxo de segmentação: envia a imagem ao backend,
 * guarda a máscara e as métricas retornadas e controla o estado de
 * processamento.
 */

import { useRef, useState } from 'react';
import type { EngineType, Metrics, SegmentationOptions } from '../types/segmentation';
import { ApiError, segmentImageApi } from '../services/api';

// Constantes
// métricas zeradas, usadas no início e ao resetar o resultado
const INITIAL_METRICS: Metrics = {
  rightArea: 0,
  leftArea: 0,
  totalArea: 0,
  totalTime: 0,
  kernelTime: 0,
  transferTime: 0,
  dice: null,
  iou: null,
};

export function useSegmentation() {
  // Estado
  // true enquanto a requisição ao backend está em andamento
  const [isProcessing, setIsProcessing] = useState(false);
  // true quando já existe um resultado de segmentação válido
  const [hasSegmented, setHasSegmented] = useState(false);
  // áreas e tempos do último resultado
  const [metrics, setMetrics] = useState<Metrics>(INITIAL_METRICS);
  // url da máscara gerada pelo backend
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  // máscaras de cada pulmão do paciente (usadas no filtro direito/esquerdo)
  const [rightMaskUrl, setRightMaskUrl] = useState<string | null>(null);
  const [leftMaskUrl, setLeftMaskUrl] = useState<string | null>(null);
  // motor que realmente processou (pode ser cpu mesmo pedindo gpu)
  const [engineUsed, setEngineUsed] = useState<EngineType | null>(null);
  // limiar efetivamente usado (Otsu, se automático)
  const [thresholdUsed, setThresholdUsed] = useState<number | null>(null);
  // avisos do backend
  const [warnings, setWarnings] = useState<string[]>([]);
  // identifica a requisição mais recente, para descartar respostas atrasadas
  const requestIdRef = useRef(0);

  // Handlers
  // descarta o resultado atual (nova imagem, remoção etc.)
  function resetSegmentation() {
    // invalida qualquer requisição em andamento
    requestIdRef.current += 1;
    setHasSegmented(false);
    setMetrics(INITIAL_METRICS);
    setMaskUrl(null);
    setRightMaskUrl(null);
    setLeftMaskUrl(null);
    setEngineUsed(null);
    setThresholdUsed(null);
    setWarnings([]);
  }

  // envia a imagem (e a máscara de referência, se houver) ao backend e
  // atualiza máscaras e métricas; onError recebe a mensagem de falha e onSuccess é chamado ao concluir.
  // Ao reprocessar (ex.: mudança de limiar), o resultado anterior continua
  // na tela até o novo chegar, e respostas de requisições antigas são ignoradas.
  async function runSegmentation(
    imagePreviewUrl: string | null,
    options: SegmentationOptions,
    groundTruth: File | null,
    onError: (msg: string) => void,
    onSuccess: () => void
  ) {
    if (!imagePreviewUrl) return;

    const requestId = ++requestIdRef.current;
    setIsProcessing(true);

    try {
      // recupera o arquivo a partir da url blob de pré-visualização
      const imageResponse = await fetch(imagePreviewUrl);
      const imageBlob = await imageResponse.blob();

      const result = await segmentImageApi(imageBlob, options, groundTruth);

      // uma requisição mais nova já foi disparada: descarta esta resposta
      if (requestId !== requestIdRef.current) return;

      setMetrics(result.metrics);
      setMaskUrl(result.mask_url);
      setRightMaskUrl(result.right_mask_url);
      setLeftMaskUrl(result.left_mask_url);
      setEngineUsed(result.engine);
      setThresholdUsed(result.threshold);
      setWarnings(result.warnings ?? []);
      setHasSegmented(true);
      onSuccess();
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(error);
      onError(
        error instanceof ApiError
          ? error.message
          : 'Erro ao comunicar com o backend FastAPI. Verifique se o servidor está rodando.'
      );
    } finally {
      // libera o botão de processar, com sucesso ou erro
      if (requestId === requestIdRef.current) setIsProcessing(false);
    }
  }

  // Retorno
  return {
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
  };
}