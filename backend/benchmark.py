"""
benchmark.py
Benchmark de limiarização CPU × GPU (executado fora da aplicação).

Motores comparados:
  CPU-A  cv2.threshold (OpenCV, otimizado; é o motor de CPU da API)
  CPU-B  NumPy (operação vetorizada, linha de base sem OpenCV)
  GPU    kernel CUDA C próprio (o mesmo da API)

Cenários:
  1. Só a limiarização, GPU sem transferências (tempo do kernel por eventos CUDA).
  2. Só a limiarização, GPU com cópias H2D + D2H.
  3. Pipeline completo da API (decodificação, limiarização, componentes, separação
     e buracos), CPU × GPU, com o tempo de cada parte.
  4. Escalabilidade: a mesma imagem redimensionada para tamanhos maiores.

Método: aquecimento descartado e N execuções por medida; reporta média, desvio,
mínimo e mediana (em ms) e o speedup pela mediana. Verifica também a diferença
de pixels entre as máscaras (esperado: 0).

Exemplos (a partir da pasta backend/):
  python benchmark.py
  python benchmark.py --repeticoes 200 --tamanhos 512 1024 2048 4096 8192 --csv bench.csv
  python benchmark.py --imagens ~/LUNA16/processado/imagens   # cenário 3 com cortes reais
"""

import argparse
import csv
import statistics
import sys
import time
from pathlib import Path

import cv2
import numpy as np

from src.services import segmentation_service as seg

EXEMPLO = Path(__file__).resolve().parent.parent / "frontend" / "public" / "image-example.png"


# Estatística
def _resumo(tempos):
    return {
        "media": statistics.mean(tempos),
        "desvio": statistics.stdev(tempos) if len(tempos) > 1 else 0.0,
        "minimo": min(tempos),
        "mediana": statistics.median(tempos),
    }


def _medir_cpu(funcao, img, t, n, aquecimento):
    """Tempo de parede (perf_counter) de uma limiarização na CPU, em ms."""
    for _ in range(aquecimento):
        funcao(img, t)
    tempos = []
    for _ in range(n):
        t0 = time.perf_counter()
        funcao(img, t)
        tempos.append((time.perf_counter() - t0) * 1000)
    return tempos


def _numpy(img, t):
    return np.where(img < t, 255, 0).astype(np.uint8)


def _medir_gpu_kernel(img, t, n, aquecimento):
    """Cenário 1: imagem já na GPU, mede só o kernel com eventos CUDA."""
    cp = seg.cp
    h, w = img.shape
    grid = ((w + seg.BLOCK[0] - 1) // seg.BLOCK[0], (h + seg.BLOCK[1] - 1) // seg.BLOCK[1])
    entrada = cp.asarray(img)
    saida = cp.empty_like(entrada)
    args = (entrada, saida, np.int32(w), np.int32(h), np.int32(t))
    inicio, fim = cp.cuda.Event(), cp.cuda.Event()

    for _ in range(aquecimento):
        seg._threshold_kernel(grid, seg.BLOCK, args)
    tempos = []
    for _ in range(n):
        inicio.record()
        seg._threshold_kernel(grid, seg.BLOCK, args)
        fim.record()
        fim.synchronize()
        tempos.append(cp.cuda.get_elapsed_time(inicio, fim))
    return tempos


def _medir_gpu_com_copias(img, t, n, aquecimento):
    """Cenário 2: H2D + kernel + D2H (mesma função usada pela API)."""
    for _ in range(aquecimento):
        seg._threshold_gpu(img, t)
    kernel, copias, total = [], [], []
    for _ in range(n):
        _, k, c = seg._threshold_gpu(img, t)
        kernel.append(k)
        copias.append(c)
        total.append(k + c)
    return total, kernel, copias


# Cenários 1, 2 e 4
def limiarizacao(args, img_base):
    linhas = []
    for tamanho in args.tamanhos:
        img = cv2.resize(img_base, (tamanho, tamanho), interpolation=cv2.INTER_LINEAR)
        n, aq, t = args.repeticoes, args.aquecimento, args.limiar

        medidas = {
            "CPU-A OpenCV": _medir_cpu(seg._threshold_opencv, img, t, n, aq),
            "CPU-B NumPy": _medir_cpu(_numpy, img, t, n, aq),
        }
        diferencas = {"CPU-B NumPy": int(np.count_nonzero(_numpy(img, t) != seg._threshold_opencv(img, t)))}

        if seg.GPU_AVAILABLE:
            medidas["GPU kernel"] = _medir_gpu_kernel(img, t, n, aq)
            total, _, copias = _medir_gpu_com_copias(img, t, n, aq)
            medidas["GPU kernel + cópias"] = total
            medidas["  (só cópias H2D + D2H)"] = copias
            mascara_gpu, _, _ = seg._threshold_gpu(img, t)
            diferencas["GPU kernel"] = int(np.count_nonzero(mascara_gpu != seg._threshold_opencv(img, t)))

        referencia = statistics.median(medidas["CPU-A OpenCV"])
        print(f"\n== Limiarização {tamanho}×{tamanho} ({n} execuções) ==")
        print(f"{'motor':26s} {'média':>9s} {'desvio':>9s} {'mínimo':>9s} {'mediana':>9s} {'speedup':>8s}")
        for motor, tempos in medidas.items():
            r = _resumo(tempos)
            speedup = referencia / r["mediana"] if not motor.startswith("  ") else None
            print(f"{motor:26s} {r['media']:9.4f} {r['desvio']:9.4f} {r['minimo']:9.4f} "
                  f"{r['mediana']:9.4f} {'' if speedup is None else f'{speedup:7.2f}x':>8s}")
            linhas.append({"cenario": "limiarizacao", "tamanho": tamanho, "motor": motor.strip(),
                           **{k: round(v, 5) for k, v in r.items()},
                           "speedup_vs_opencv": "" if speedup is None else round(speedup, 3)})
        for motor, d in diferencas.items():
            print(f"diferença de pixels {motor} × OpenCV: {d}")
            if d:
                print("  ATENÇÃO: máscaras diferentes!", file=sys.stderr)
    return linhas


# Cenário 3
def pipeline(args, imagens):
    motores = ["cpu"] + (["gpu"] if seg.GPU_AVAILABLE else [])
    dados = [p.read_bytes() for p in imagens]
    linhas = []
    print(f"\n== Pipeline completo da API ({len(dados)} imagem(ns) × {args.repeticoes_pipeline} execuções) ==")
    print(f"{'motor':6s} {'total':>9s} {'limiar.':>9s} {'cópias':>9s} {'restante':>9s}   (medianas, ms)")
    medianas = {}
    for motor in motores:
        for b in dados[: args.aquecimento]:
            seg.SegmentationService.process(b, args.limiar, motor)
        total, limiar, copias = [], [], []
        for _ in range(args.repeticoes_pipeline):
            for b in dados:
                m = seg.SegmentationService.process(b, args.limiar, motor)["metrics"]
                total.append(m["totalTime"])
                limiar.append(m["kernelTime"])
                copias.append(m["transferTime"])
        resto = [a - b - c for a, b, c in zip(total, limiar, copias)]
        med = {k: statistics.median(v) for k, v in
               (("total", total), ("limiar", limiar), ("copias", copias), ("restante", resto))}
        medianas[motor] = med
        print(f"{motor:6s} {med['total']:9.3f} {med['limiar']:9.4f} {med['copias']:9.4f} {med['restante']:9.3f}")
        linhas.append({"cenario": "pipeline", "tamanho": "", "motor": motor,
                       **{k: round(v, 5) for k, v in _resumo(total).items()},
                       "speedup_vs_opencv": ""})
    if "gpu" in medianas:
        print(f"speedup do pipeline (cpu/gpu): {medianas['cpu']['total'] / medianas['gpu']['total']:.2f}x")
    return linhas


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark de limiarização CPU × GPU.")
    parser.add_argument("--imagem", default=str(EXEMPLO), help="imagem base dos cenários 1, 2 e 4")
    parser.add_argument("--imagens", help="pasta de PNGs para o cenário 3 (padrão: a imagem base)")
    parser.add_argument("--tamanhos", type=int, nargs="+", default=[512, 1024, 2048, 4096])
    parser.add_argument("--limiar", type=int, default=120)
    parser.add_argument("--repeticoes", type=int, default=100)
    parser.add_argument("--repeticoes-pipeline", type=int, default=20)
    parser.add_argument("--aquecimento", type=int, default=10)
    parser.add_argument("--csv", help="salva os resultados neste CSV")
    args = parser.parse_args()

    img = cv2.imread(args.imagem, cv2.IMREAD_GRAYSCALE)
    if img is None:
        sys.exit(f"Não foi possível ler {args.imagem}")

    if seg.GPU_AVAILABLE:
        props = seg.cp.cuda.runtime.getDeviceProperties(0)
        print(f"GPU: {props['name'].decode()}")
    else:
        print("GPU indisponível: medindo só a CPU.")

    linhas = limiarizacao(args, img)

    if args.imagens:
        imagens = sorted(Path(args.imagens).expanduser().glob("*.png"))[:20]
    else:
        imagens = [Path(args.imagem)]
    linhas += pipeline(args, imagens)

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=list(linhas[0].keys()))
            escritor.writeheader()
            escritor.writerows(linhas)
        print(f"\nResultados salvos em {args.csv}")


if __name__ == "__main__":
    main()
