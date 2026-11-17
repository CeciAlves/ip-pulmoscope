"""
segmentation_service.py
Serviço de segmentação pulmonar em cortes axiais de TC. Recebe a imagem,
aplica limiarização, isola os dois maiores componentes internos (os pulmões)
e devolve a máscara binária, as métricas e o motor realmente usado.

Motores:
 - cpu: limiarização com NumPy.
 - gpu: limiarização com CuPy (CUDA). Opcional: sem GPU ou sem CuPy,
   o serviço cai automaticamente para a CPU.
Os componentes conectados (OpenCV) rodam sempre na CPU.
"""

import logging
import time
from typing import Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Suporte opcional a GPU

# o CuPy é opcional: sem ele (ou sem placa NVIDIA), o sistema roda só na CPU
try:
    import cupy as cp

    GPU_AVAILABLE = cp.cuda.runtime.getDeviceCount() > 0
except Exception:
    cp = None
    GPU_AVAILABLE = False


def _threshold_gpu(img: np.ndarray, threshold: int) -> Tuple[np.ndarray, float, float]:
    """Limiarização na GPU. Retorna (máscara, tempo do kernel, tempo de cópia), em ms."""
    # H2D: copia a imagem da memória da CPU para a GPU
    t0 = time.perf_counter()
    img_gpu = cp.asarray(img)
    # as chamadas de GPU são assíncronas: sincroniza antes de parar o relógio
    cp.cuda.Stream.null.synchronize()
    h2d_ms = (time.perf_counter() - t0) * 1000

    # kernel: pixels abaixo do limiar viram 255, os demais 0
    t1 = time.perf_counter()
    mask_gpu = cp.where(img_gpu < threshold, 255, 0).astype(cp.uint8)
    cp.cuda.Stream.null.synchronize()
    kernel_ms = (time.perf_counter() - t1) * 1000

    # D2H: traz a máscara de volta para a CPU
    t2 = time.perf_counter()
    mask = cp.asnumpy(mask_gpu)
    d2h_ms = (time.perf_counter() - t2) * 1000

    return mask, kernel_ms, h2d_ms + d2h_ms


def _threshold_cpu(img: np.ndarray, threshold: int) -> Tuple[np.ndarray, float, float]:
    """Limiarização na CPU. Retorna (máscara, tempo do kernel, tempo de cópia), em ms."""
    t0 = time.perf_counter()
    mask = np.where(img < threshold, 255, 0).astype(np.uint8)
    kernel_ms = (time.perf_counter() - t0) * 1000
    # na CPU não há cópia de dados entre dispositivos
    return mask, kernel_ms, 0.0


def _warmup_gpu() -> None:
    """Executa o caminho completo da GPU (H2D, kernel, D2H) para pagar a inicialização do CUDA antes da primeira requisição."""
    sample = np.zeros((512, 512), dtype=np.uint8)
    # Duas passadas: a primeira inicializa, a segunda estabiliza o pool de memória
    for _ in range(2):
        _threshold_gpu(sample, 120)


# o aquecimento evita que a primeira segmentação na GPU pareça muito mais lenta
if GPU_AVAILABLE:
    try:
        _warmup_gpu()
    except Exception:
        logger.exception("Falha ao inicializar a GPU: usando apenas a CPU.")
        GPU_AVAILABLE = False


# Constantes
MIN_COMPONENT_AREA = 500    # área mínima para ser considerado candidato a pulmão
MAX_LUNG_COMPONENTS = 2     # quantidade de componentes mantidos na máscara final (os dois pulmões)


class SegmentationService:
    @staticmethod
    def process(
        image_bytes: bytes, threshold: int, engine: str
    ) -> Tuple[dict, np.ndarray, str]:
        """
        Segmenta os pulmões da imagem e retorna (métricas, máscara binária, motor usado).
        O motor usado pode diferir do solicitado (fallback para CPU).
        Levanta ValueError se a imagem não puder ser decodificada.
        """
        # relógio do tempo total (inclui a decodificação da imagem)
        total_start = time.perf_counter()

        # Decodificação
        # converte os bytes do upload em imagem em escala de cinza
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        if img is None:
            raise ValueError("Não foi possível decodificar a imagem.")

        height, width = img.shape

        # Etapa 1: Limiarização (CPU ou GPU)
        engine_used = "cpu"
        initial_mask = None

        if engine == "gpu" and not GPU_AVAILABLE:
            logger.warning("GPU solicitada, mas indisponível: processando na CPU.")
        elif engine == "gpu":
            try:
                initial_mask, kernel_time, transfer_time = _threshold_gpu(img, threshold)
                engine_used = "gpu"
            except Exception:
                # qualquer falha de CUDA cai para a CPU em vez de derrubar a requisição
                logger.exception("Erro na GPU: processando na CPU.")

        if engine_used == "cpu":
            initial_mask, kernel_time, transfer_time = _threshold_cpu(img, threshold)

        # Etapa 2: Componentes conectados
        # rotula as regiões conectadas (vizinhança de 8) e calcula área e centróide de cada uma
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            initial_mask, connectivity=8
        )

        # Etapa 3: Filtro de candidatos
        candidatos = []

        # começa em 1 porque o rótulo 0 é o fundo
        for i in range(1, num_labels):
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            area = stats[i, cv2.CC_STAT_AREA]

            # regiões que tocam a borda são o fundo externo, não pulmão
            toca_borda = (x == 0 or y == 0 or (x + w) >= width or (y + h) >= height)

            # mantém apenas regiões internas e grandes o bastante
            if not toca_borda and area > MIN_COMPONENT_AREA:
                candidatos.append((area, i))

        # Etapa 4: Ordenação
        # maiores áreas primeiro
        candidatos.sort(key=lambda item: item[0], reverse=True)

        # Etapa 5: Máscara final
        final_mask = np.zeros_like(img, dtype=np.uint8)

        right_area = 0
        left_area = 0

        # mantém só os maiores componentes internos (os pulmões)
        for k in range(min(MAX_LUNG_COMPONENTS, len(candidatos))):
            area, label_idx = candidatos[k]
            component_mask = (labels == label_idx).astype(np.uint8) * 255
            final_mask = cv2.bitwise_or(final_mask, component_mask)

            # lado pelo centróide em X (convenção radiológica: o pulmão direito
            # do paciente aparece no lado esquerdo da imagem)
            cx = centroids[label_idx, 0]
            if cx < (width / 2):
                right_area += area
            else:
                left_area += area

        # Métricas
        # tempo de ponta a ponta, em milissegundos
        total_time = (time.perf_counter() - total_start) * 1000

        metrics = {
            "rightArea": int(right_area),
            "leftArea": int(left_area),
            "totalArea": int(right_area + left_area),
            "totalTime": round(total_time, 2),
            # kernelTime: só a limiarização (mesmo trecho nos dois motores)
            "kernelTime": round(kernel_time, 2),
            # transferTime: H2D + D2H (0 na CPU)
            "transferTime": round(transfer_time, 2),
        }

        return metrics, final_mask, engine_used