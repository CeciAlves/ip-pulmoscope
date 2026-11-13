/**
 * segmentation.ts
 * Tipos compartilhados da segmentação pulmonar. Usados pelo App, pelos hooks
 * e pelos componentes para manter o contrato de dados em um só lugar.
 */

// Tipos de seleção
// pulmão exibido na visualização
export type LungFilterType = 'both' | 'right' | 'left';

// motor de processamento usado no backend
export type EngineType = 'gpu' | 'cpu';

// aba ativa do visualizador
export type TabType = 'original' | 'mask' | 'overlay';

// Resultados
// métricas retornadas pelo backend após a segmentação
export interface Metrics {
  // área do pulmão direito
  rightArea: number;
  // área do pulmão esquerdo
  leftArea: number;
  // soma das duas áreas
  totalArea: number;
  // tempo total da requisição de segmentação
  totalTime: number;
  // tempo de execução do kernel (processamento em si)
  kernelTime: number;
  // tempo de cópia de dados entre CPU e GPU
  transferTime: number;
}