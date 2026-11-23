"""
segmentation_service.py
Serviço de segmentação pulmonar em cortes axiais de TC. Recebe a imagem,
aplica limiarização, isola os dois maiores componentes internos (os pulmões),
separa direito × esquerdo e devolve as máscaras, as métricas e o motor usado.

Motores:
 - cpu: limiarização com cv2.threshold (OpenCV).
 - gpu: kernel CUDA C próprio (compilado em tempo de execução pelo CuPy).
   Opcional: sem GPU ou sem CuPy, o serviço cai automaticamente para a CPU.
Os componentes conectados (OpenCV) rodam sempre na CPU.
"""

import logging
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Suporte opcional a GPU

# Kernel de limiarização invertida em CUDA C: um thread por pixel, blocos 16x16.
# Threads vizinhas em x leem/escrevem bytes vizinhos (acesso coalescido).
THRESHOLD_KERNEL_SRC = r"""
extern "C" __global__
void threshold_inv(const unsigned char* in, unsigned char* out,
                   int width, int height, int threshold)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= width || y >= height) return;

    int idx = y * width + x;
    out[idx] = (in[idx] < threshold) ? 255 : 0;
}
"""
BLOCK = (16, 16)

# o CuPy é opcional: sem ele (ou sem placa NVIDIA), o sistema roda só na CPU
try:
    import cupy as cp

    GPU_AVAILABLE = cp.cuda.runtime.getDeviceCount() > 0
    _threshold_kernel = cp.RawKernel(THRESHOLD_KERNEL_SRC, "threshold_inv")
except Exception:
    cp = None
    GPU_AVAILABLE = False


def _threshold_gpu(img: np.ndarray, threshold: int) -> Tuple[np.ndarray, float, float]:
    """Limiarização na GPU. Retorna (máscara, tempo do kernel, tempo de cópia), em ms."""
    height, width = img.shape
    grid = ((width + BLOCK[0] - 1) // BLOCK[0], (height + BLOCK[1] - 1) // BLOCK[1])

    # eventos CUDA medem o tempo no próprio dispositivo (mais preciso que o relógio da CPU)
    e0, e1, e2, e3 = (cp.cuda.Event() for _ in range(4))

    # H2D: copia a imagem da memória da CPU para a GPU
    e0.record()
    img_gpu = cp.asarray(np.ascontiguousarray(img))
    mask_gpu = cp.empty_like(img_gpu)
    e1.record()

    # kernel: pixels abaixo do limiar viram 255, os demais 0
    _threshold_kernel(
        grid, BLOCK, (img_gpu, mask_gpu, np.int32(width), np.int32(height), np.int32(threshold))
    )
    e2.record()

    # D2H: traz a máscara de volta para a CPU
    mask = cp.asnumpy(mask_gpu)
    e3.record()
    e3.synchronize()

    kernel_ms = cp.cuda.get_elapsed_time(e1, e2)
    transfer_ms = cp.cuda.get_elapsed_time(e0, e1) + cp.cuda.get_elapsed_time(e2, e3)
    return mask, kernel_ms, transfer_ms


def _threshold_opencv(img: np.ndarray, threshold: int) -> np.ndarray:
    """THRESH_BINARY_INV zera "pixel > t" e marca o resto: com t = T - 1,
    marca exatamente "pixel < T", a mesma regra do kernel CUDA."""
    _, mask = cv2.threshold(img, threshold - 1, 255, cv2.THRESH_BINARY_INV)
    return mask


def _threshold_cpu(img: np.ndarray, threshold: int) -> Tuple[np.ndarray, float, float]:
    """Limiarização na CPU (cv2.threshold, implementação de referência).
    Retorna (máscara, tempo do kernel, tempo de cópia), em ms."""
    t0 = time.perf_counter()
    mask = _threshold_opencv(img, threshold)
    kernel_ms = (time.perf_counter() - t0) * 1000
    # na CPU não há cópia de dados entre dispositivos
    return mask, kernel_ms, 0.0


def _otsu_threshold(img: np.ndarray) -> int:
    """Limiar automático (Otsu). O OpenCV considera escuro "pixel <= t"; na regra
    "pixel < T" do projeto isso equivale a T = t + 1."""
    t, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return int(t) + 1


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    """Preenche buracos internos (vasos claros dentro do pulmão)."""
    # borda de 1 px garante que (0,0) seja fundo ligado ao exterior
    padded = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(padded, None, (0, 0), 255)
    # o que continua 0 não é alcançável de fora: são os buracos
    holes = padded[1:-1, 1:-1] == 0
    filled = mask.copy()
    filled[holes] = 255
    return filled


def _dice_iou(pred: np.ndarray, gt: np.ndarray) -> Tuple[float, float]:
    """Dice e IoU entre a máscara obtida e a de referência (ambas binárias)."""
    pred = pred > 0
    gt = gt > 0
    inter = int(np.count_nonzero(pred & gt))
    soma = int(np.count_nonzero(pred)) + int(np.count_nonzero(gt))
    uniao = soma - inter
    # as duas vazias: concordância total
    if soma == 0:
        return 1.0, 1.0
    return 2 * inter / soma, inter / uniao


def _warmup_gpu() -> None:
    """Executa o caminho completo da GPU (H2D, kernel, D2H) para pagar a inicialização do CUDA antes da primeira requisição."""
    sample = np.zeros((512, 512), dtype=np.uint8)
    # Duas passadas: a primeira inicializa (e compila o kernel), a segunda estabiliza o pool de memória
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
EXPECTED_SIZE = 512         # tamanho padrão de um corte de TC
MAX_SIZE = 4096             # maior dimensão aceita


class SegmentationService:
    @staticmethod
    def process(
        image_bytes: bytes,
        threshold: int,
        engine: str,
        auto_threshold: bool = False,
        fill_holes: bool = True,
        ground_truth: Optional[bytes] = None,
    ) -> dict:
        """
        Segmenta os pulmões da imagem e retorna um dicionário com as máscaras
        (ambos, direito e esquerdo), métricas, limiar usado, motor usado e avisos.
        O motor usado pode diferir do solicitado (fallback para CPU).
        Se ground_truth (máscara de referência em PNG) for enviada, calcula Dice e IoU.
        Levanta ValueError se a imagem ou os parâmetros forem inválidos.
        """
        # relógio do tempo total (inclui a decodificação da imagem)
        total_start = time.perf_counter()
        warnings: List[str] = []

        if not 0 <= threshold <= 255:
            raise ValueError("O limiar deve estar entre 0 e 255.")

        # Decodificação
        # converte os bytes do upload em imagem em escala de cinza
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

        if img is None:
            raise ValueError("Não foi possível decodificar a imagem. Envie um PNG ou JPEG válido.")

        height, width = img.shape

        # máscara de referência (opcional): decodificada antes do processamento
        # para recusar logo um arquivo inválido
        gt_mask = None
        if ground_truth:
            gt_mask = cv2.imdecode(np.frombuffer(ground_truth, np.uint8), cv2.IMREAD_GRAYSCALE)
            if gt_mask is None:
                raise ValueError("Não foi possível decodificar a máscara de referência.")
            if gt_mask.shape != img.shape:
                gh, gw = gt_mask.shape
                raise ValueError(
                    f"A máscara de referência ({gw}×{gh}) deve ter o mesmo tamanho da imagem ({width}×{height})."
                )

        # Validação de dimensões
        if max(height, width) > MAX_SIZE:
            raise ValueError(f"Imagem {width}×{height} maior que o limite de {MAX_SIZE} px.")
        if (width, height) != (EXPECTED_SIZE, EXPECTED_SIZE):
            warnings.append(
                f"Imagem {width}×{height} fora do padrão {EXPECTED_SIZE}×{EXPECTED_SIZE} de TC: "
                "a área em pixels não é comparável com cortes de outra resolução."
            )

        # limiar automático (Otsu) substitui o valor do slider
        if auto_threshold:
            threshold = _otsu_threshold(img)

        # Etapa 1: Limiarização (CPU ou GPU)
        engine_used = "cpu"
        initial_mask = None

        if engine == "gpu" and not GPU_AVAILABLE:
            logger.warning("GPU solicitada, mas indisponível: processando na CPU.")
            warnings.append("GPU indisponível: limiarização executada na CPU.")
        elif engine == "gpu":
            try:
                initial_mask, kernel_time, transfer_time = _threshold_gpu(img, threshold)
                engine_used = "gpu"
            except Exception:
                # qualquer falha de CUDA cai para a CPU em vez de derrubar a requisição
                logger.exception("Erro na GPU: processando na CPU.")
                warnings.append("Falha na GPU: limiarização executada na CPU.")

        if engine_used == "cpu":
            initial_mask, kernel_time, transfer_time = _threshold_cpu(img, threshold)

        # Etapa 2: Componentes conectados
        # rotula as regiões conectadas (vizinhança de 8) e calcula área e centróide de cada uma
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            initial_mask, connectivity=8
        )

        # Etapa 3: Filtro de candidatos
        candidatos = []
        # componentes que tocam a borda: ar fora do corpo
        externos = np.zeros(num_labels, dtype=bool)

        # começa em 1 porque o rótulo 0 é o fundo
        for i in range(1, num_labels):
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            area = stats[i, cv2.CC_STAT_AREA]

            # regiões que tocam a borda são o fundo externo, não pulmão
            toca_borda = (x == 0 or y == 0 or (x + w) >= width or (y + h) >= height)
            if toca_borda:
                externos[i] = True
                continue

            # mantém apenas regiões internas e grandes o bastante
            if area > MIN_COMPONENT_AREA:
                candidatos.append((area, i))

        # Etapa 4: Ordenação
        # maiores áreas primeiro
        candidatos.sort(key=lambda item: item[0], reverse=True)
        selecionados = candidatos[:MAX_LUNG_COMPONENTS]

        # Etapa 5: Separação direito × esquerdo
        # convenção radiológica: o pulmão direito do paciente aparece no lado
        # esquerdo da imagem. Com dois pulmões, o de centróide mais à esquerda é
        # o direito. Com um só, compara com o centro do CORPO (tudo que não é ar
        # externo), e não com o centro da imagem: o paciente pode estar deslocado.
        right_mask = np.zeros_like(img, dtype=np.uint8)
        left_mask = np.zeros_like(img, dtype=np.uint8)

        if len(selecionados) == 2:
            (_, a), (_, b) = selecionados
            direito, esquerdo = (a, b) if centroids[a, 0] <= centroids[b, 0] else (b, a)
            right_mask[labels == direito] = 255
            left_mask[labels == esquerdo] = 255
        elif len(selecionados) == 1:
            label_idx = selecionados[0][1]
            colunas_corpo = np.nonzero(~externos[labels])[1]
            centro_corpo = colunas_corpo.mean() if colunas_corpo.size else width / 2
            destino = right_mask if centroids[label_idx, 0] < centro_corpo else left_mask
            destino[labels == label_idx] = 255
            warnings.append("Apenas uma região pulmonar encontrada.")
        else:
            warnings.append("Nenhuma região pulmonar encontrada: ajuste o limiar.")

        # Etapa 6: Preenchimento de buracos (por pulmão)
        if fill_holes:
            right_mask = _fill_holes(right_mask)
            left_mask = _fill_holes(left_mask)

        final_mask = cv2.bitwise_or(right_mask, left_mask)
        right_area = int(cv2.countNonZero(right_mask))
        left_area = int(cv2.countNonZero(left_mask))

        # Qualidade: comparação com a máscara de referência (ambos os pulmões)
        dice = iou = None
        if gt_mask is not None:
            dice, iou = _dice_iou(final_mask, gt_mask)

        # Métricas
        # tempo de ponta a ponta, em milissegundos
        total_time = (time.perf_counter() - total_start) * 1000

        metrics = {
            "rightArea": right_area,
            "leftArea": left_area,
            "totalArea": right_area + left_area,
            "totalTime": round(total_time, 2),
            # kernelTime: só a limiarização (mesmo trecho nos dois motores)
            "kernelTime": round(kernel_time, 4),
            # transferTime: H2D + D2H (0 na CPU)
            "transferTime": round(transfer_time, 4),
            # Dice e IoU contra a referência (None sem máscara de referência)
            "dice": None if dice is None else round(dice, 4),
            "iou": None if iou is None else round(iou, 4),
        }

        return {
            "metrics": metrics,
            "mask": final_mask,
            "right_mask": right_mask,
            "left_mask": left_mask,
            "engine": engine_used,
            "threshold": int(threshold),
            "width": int(width),
            "height": int(height),
            "warnings": warnings,
        }
