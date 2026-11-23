"""
luna16.py
Ferramentas offline para o dataset LUNA16 (executadas fora da aplicação).

  preparar: lê os volumes .mhd, aplica a janela de HU, converte para 8 bits e
            salva cortes axiais em PNG (ápice, região média e base, além dos
            cortes com nódulos, se annotations.csv for informado) junto com as
            máscaras de referência dos pulmões (seg-lungs-LUNA16).
  avaliar:  segmenta os cortes preparados com o mesmo serviço da API e calcula
            Dice e IoU de cada corte contra a máscara de referência.
  buscar:   varre limiares e escolhe o de maior Dice médio, separando os
            volumes em duas metades (ajuste e teste).

Dependência extra (só para "preparar"): pip install SimpleITK

Exemplos (a partir da pasta backend/):
  python luna16.py preparar --volumes ~/LUNA16/subset0 \\
      --mascaras ~/LUNA16/seg-lungs-LUNA16 --anotacoes ~/LUNA16/annotations.csv \\
      --saida ~/LUNA16/processado
  python luna16.py avaliar --dados ~/LUNA16/processado --motor gpu --csv resultado.csv
"""

import argparse
import csv
import statistics
import sys
from pathlib import Path

import cv2
import numpy as np

# Janela de HU: de -1000 (ar) a 400 (tecido mole/osso leve). Pulmão (~-850 HU)
# fica escuro e o corpo claro, como espera a limiarização "pixel < T".
HU_MIN = -1000
HU_MAX = 400

# rótulos dos pulmões nas máscaras seg-lungs-LUNA16 (5 = traqueia, descartada)
LUNG_LABELS = (3, 4)

# posições relativas (dentro da extensão dos pulmões) dos cortes extraídos:
# ápice, terço superior, meio, terço inferior e base
SLICE_POSITIONS = (0.1, 0.3, 0.5, 0.7, 0.9)


# Preparação
def _window(hu: np.ndarray) -> np.ndarray:
    """Converte um corte em HU para 8 bits usando a janela definida."""
    hu = np.clip(hu.astype(np.float32), HU_MIN, HU_MAX)
    return np.round((hu - HU_MIN) * 255.0 / (HU_MAX - HU_MIN)).astype(np.uint8)


def _nodule_slices(volume, anotacoes, uid) -> set:
    """Índices z dos cortes que passam pelo centro dos nódulos anotados."""
    fatias = set()
    for linha in anotacoes.get(uid, []):
        ponto = (float(linha["coordX"]), float(linha["coordY"]), float(linha["coordZ"]))
        _, _, z = volume.TransformPhysicalPointToIndex(ponto)
        fatias.add(int(z))
    return fatias


def preparar(args) -> None:
    try:
        import SimpleITK as sitk
    except ImportError:
        sys.exit("SimpleITK não instalado. Rode: pip install SimpleITK")

    volumes_dir = Path(args.volumes).expanduser()
    mascaras_dir = Path(args.mascaras).expanduser() if args.mascaras else None
    saida = Path(args.saida).expanduser()
    (saida / "imagens").mkdir(parents=True, exist_ok=True)
    (saida / "mascaras").mkdir(parents=True, exist_ok=True)

    # annotations.csv: seriesuid, coordX, coordY, coordZ, diameter_mm (coordenadas em mm)
    anotacoes = {}
    if args.anotacoes:
        with open(Path(args.anotacoes).expanduser(), newline="") as f:
            for linha in csv.DictReader(f):
                anotacoes.setdefault(linha["seriesuid"], []).append(linha)

    arquivos = sorted(volumes_dir.glob("*.mhd"))
    if args.limite:
        arquivos = arquivos[: args.limite]
    if not arquivos:
        sys.exit(f"Nenhum volume .mhd encontrado em {volumes_dir}")

    total = 0
    for caminho in arquivos:
        uid = caminho.stem
        volume = sitk.ReadImage(str(caminho))
        # GetArrayFromImage devolve (z, y, x): cada volume[z] é um corte axial
        hu = sitk.GetArrayFromImage(volume)

        mascara = None
        if mascaras_dir is not None:
            caminho_mascara = mascaras_dir / f"{uid}.mhd"
            if caminho_mascara.exists():
                rotulos = sitk.GetArrayFromImage(sitk.ReadImage(str(caminho_mascara)))
                mascara = np.isin(rotulos, LUNG_LABELS)
            else:
                print(f"  aviso: sem máscara de referência para {uid}")

        # extensão dos pulmões no eixo z (ou o volume inteiro, sem máscara)
        if mascara is not None and mascara.any():
            zs = np.nonzero(mascara.any(axis=(1, 2)))[0]
            z_ini, z_fim = int(zs[0]), int(zs[-1])
        else:
            z_ini, z_fim = 0, hu.shape[0] - 1

        fatias = {round(z_ini + p * (z_fim - z_ini)) for p in SLICE_POSITIONS}
        fatias |= _nodule_slices(volume, anotacoes, uid)
        fatias = sorted(z for z in fatias if 0 <= z < hu.shape[0])

        for z in fatias:
            nome = f"{uid}_z{z:03d}.png"
            cv2.imwrite(str(saida / "imagens" / nome), _window(hu[z]))
            if mascara is not None:
                cv2.imwrite(str(saida / "mascaras" / nome), mascara[z].astype(np.uint8) * 255)
            total += 1

        print(f"{uid}: {len(fatias)} cortes")

    print(f"\n{total} cortes salvos em {saida}")


# Avaliação
def avaliar(args) -> None:
    # importado aqui para "preparar" não depender do serviço (nem da GPU)
    from src.services.segmentation_service import SegmentationService

    dados = Path(args.dados).expanduser()
    imagens = sorted((dados / "imagens").glob("*.png"))
    if not imagens:
        sys.exit(f"Nenhuma imagem em {dados / 'imagens'}")

    linhas = []
    for caminho in imagens:
        caminho_mascara = dados / "mascaras" / caminho.name
        if not caminho_mascara.exists():
            continue
        resultado = SegmentationService.process(
            caminho.read_bytes(),
            args.limiar,
            args.motor,
            auto_threshold=args.otsu,
            fill_holes=not args.sem_preencher,
            ground_truth=caminho_mascara.read_bytes(),
        )
        m = resultado["metrics"]
        linhas.append({
            "corte": caminho.stem,
            "limiar": resultado["threshold"],
            "motor": resultado["engine"],
            "dice": m["dice"],
            "iou": m["iou"],
            "area_total_px": m["totalArea"],
            "tempo_total_ms": m["totalTime"],
        })
        print(f"{caminho.stem}: Dice {m['dice']:.4f}  IoU {m['iou']:.4f}")

    if not linhas:
        sys.exit("Nenhum corte com máscara de referência.")

    dices = [l["dice"] for l in linhas]
    ious = [l["iou"] for l in linhas]
    desvio = statistics.stdev if len(linhas) > 1 else (lambda _: 0.0)
    print(f"\n{len(linhas)} cortes")
    print(f"Dice: média {statistics.mean(dices):.4f}  desvio {desvio(dices):.4f}  mínimo {min(dices):.4f}")
    print(f"IoU:  média {statistics.mean(ious):.4f}  desvio {desvio(ious):.4f}  mínimo {min(ious):.4f}")

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=list(linhas[0].keys()))
            escritor.writeheader()
            escritor.writerows(linhas)
        print(f"Resultados por corte salvos em {args.csv}")


# Busca do limiar
def buscar(args) -> None:
    """Varre limiares e escolhe o de maior Dice médio. Os volumes são divididos
    em duas metades (ajuste e teste) para o limiar não ser escolhido e medido
    nos mesmos dados."""
    from src.services.segmentation_service import SegmentationService

    dados = Path(args.dados).expanduser()
    cortes = []
    for caminho in sorted((dados / "imagens").glob("*.png")):
        caminho_mascara = dados / "mascaras" / caminho.name
        if caminho_mascara.exists():
            # lidos uma vez só: o laço abaixo reprocessa cada corte várias vezes
            cortes.append((caminho.stem, caminho.read_bytes(), caminho_mascara.read_bytes()))
    if not cortes:
        sys.exit(f"Nenhum corte com máscara de referência em {dados}")

    # divisão por volume (cortes do mesmo paciente ficam do mesmo lado)
    volumes = sorted({nome.rsplit("_z", 1)[0] for nome, _, _ in cortes})
    ajuste = set(volumes[::2])

    limiares = list(range(args.de, args.ate + 1, args.passo))
    curva = []
    for t in limiares:
        dice = {"ajuste": [], "teste": []}
        for nome, img, gt in cortes:
            m = SegmentationService.process(
                img, t, args.motor, fill_holes=not args.sem_preencher, ground_truth=gt
            )["metrics"]
            lado = "ajuste" if nome.rsplit("_z", 1)[0] in ajuste else "teste"
            dice[lado].append(m["dice"])
        linha = {
            "limiar": t,
            "dice_ajuste": statistics.mean(dice["ajuste"]),
            "dice_teste": statistics.mean(dice["teste"]) if dice["teste"] else float("nan"),
            "dice_todos": statistics.mean(dice["ajuste"] + dice["teste"]),
        }
        curva.append(linha)
        print(f"T={t:3d}  Dice ajuste {linha['dice_ajuste']:.4f}  teste {linha['dice_teste']:.4f}")

    melhor = max(curva, key=lambda l: l["dice_ajuste"])
    print(f"\n{len(cortes)} cortes de {len(volumes)} volumes "
          f"({len(ajuste)} volumes de ajuste, {len(volumes) - len(ajuste)} de teste)")
    print(f"Melhor limiar (escolhido no ajuste): T={melhor['limiar']}")
    print(f"  Dice no ajuste {melhor['dice_ajuste']:.4f}  no teste {melhor['dice_teste']:.4f}")
    padrao = next((l for l in curva if l["limiar"] == 120), None)
    if padrao:
        print(f"  Referência T=120: ajuste {padrao['dice_ajuste']:.4f}  teste {padrao['dice_teste']:.4f}")

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=list(curva[0].keys()))
            escritor.writeheader()
            escritor.writerows(curva)
        print(f"Curva salva em {args.csv}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Preparação e avaliação com o LUNA16.")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("preparar", help="converte volumes .mhd em cortes PNG + máscaras")
    p.add_argument("--volumes", required=True, help="pasta com os .mhd/.raw (ex.: subset0)")
    p.add_argument("--mascaras", help="pasta seg-lungs-LUNA16 (máscaras de referência)")
    p.add_argument("--anotacoes", help="annotations.csv (inclui os cortes com nódulos)")
    p.add_argument("--saida", required=True, help="pasta de saída (imagens/ e mascaras/)")
    p.add_argument("--limite", type=int, help="processa só os N primeiros volumes")
    p.set_defaults(func=preparar)

    a = sub.add_parser("avaliar", help="calcula Dice e IoU nos cortes preparados")
    a.add_argument("--dados", required=True, help="pasta gerada por 'preparar'")
    a.add_argument("--limiar", type=int, default=120)
    a.add_argument("--otsu", action="store_true", help="usa o limiar automático (Otsu)")
    a.add_argument("--motor", choices=["cpu", "gpu"], default="cpu")
    a.add_argument("--sem-preencher", action="store_true", help="não preenche os buracos")
    a.add_argument("--csv", help="salva os resultados por corte neste CSV")
    a.set_defaults(func=avaliar)

    b = sub.add_parser("buscar", help="procura o limiar de maior Dice médio")
    b.add_argument("--dados", required=True, help="pasta gerada por 'preparar'")
    b.add_argument("--de", type=int, default=60)
    b.add_argument("--ate", type=int, default=180)
    b.add_argument("--passo", type=int, default=5)
    b.add_argument("--motor", choices=["cpu", "gpu"], default="cpu")
    b.add_argument("--sem-preencher", action="store_true", help="não preenche os buracos")
    b.add_argument("--csv", help="salva a curva limiar × Dice neste CSV")
    b.set_defaults(func=buscar)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
