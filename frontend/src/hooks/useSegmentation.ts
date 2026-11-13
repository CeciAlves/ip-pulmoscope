/**
 * useSegmentation.ts
 * Hook que gerencia o fluxo de segmentação: envia a imagem ao backend,
 * guarda a máscara e as métricas retornadas e controla o estado de
 * processamento.
 */

import { useState } from 'react';
import type { EngineType, Metrics } from '../types/segmentation';
import { segmentImageApi } from '../services/api';

// Constantes
// métricas zeradas, usadas no início e ao resetar o resultado
const INITIAL_METRICS: Metrics = {
  rightArea: 0,
  leftArea: 0,
  totalArea: 0,
  totalTime: 0,
  kernelTime: 0,
  transferTime: 0,
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

  // Handlers
  // descarta o resultado atual (nova imagem, remoção etc.)
  function resetSegmentation() {
    setHasSegmented(false);
    setMetrics(INITIAL_METRICS);
    setMaskUrl(null);
  }

  // envia a imagem ao backend e atualiza máscara e métricas;
  // onError recebe a mensagem de falha e onSuccess é chamado ao concluir
  async function runSegmentation(
    imagePreviewUrl: string | null,
    threshold: number,
    engine: EngineType,
    onError: (msg: string) => void,
    onSuccess: () => void
  ) {
    // ignora se não há imagem ou se já existe uma requisição em andamento
    if (!imagePreviewUrl || isProcessing) return;

    setIsProcessing(true);
    setHasSegmented(false);

    try {
      // recupera o arquivo a partir da url blob de pré-visualização
      const imageResponse = await fetch(imagePreviewUrl);
      const imageBlob = await imageResponse.blob();

      const result = await segmentImageApi(imageBlob, threshold, engine);

      setMetrics(result.metrics);
      setMaskUrl(result.mask_url);
      setHasSegmented(true);
      onSuccess();
    } catch (error) {
      console.error(error);
      onError('Erro ao comunicar com o backend FastAPI. Verifique se o servidor está rodando.');
    } finally {
      // libera o botão de processar, com sucesso ou erro
      setIsProcessing(false);
    }
  }

  // Retorno
  return {
    isProcessing,
    hasSegmented,
    metrics,
    maskUrl,
    runSegmentation,
    resetSegmentation,
  };
}