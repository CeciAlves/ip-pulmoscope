"""
test_api.py
Testes da API (contrato e erros) com o TestClient do FastAPI.

As imagens são sintéticas e geradas aqui: um "corpo" claro com dois "pulmões"
escuros em forma de elipse, cujas áreas são conhecidas. Os testes rodam sem
GPU; os que dependem dela são pulados quando não há placa disponível.

Executar a partir da pasta backend/:
  python -m pytest tests -v
"""

import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app
from src.services import segmentation_service as seg

client = TestClient(app)

SIZE = 512
BODY, LUNG, AIR = 200, 30, 0
# centros das elipses: o pulmão DIREITO do paciente fica à ESQUERDA da imagem
RIGHT_LUNG = ((170, 256), (60, 120))
LEFT_LUNG = ((342, 256), (55, 110))


# Utilitários
def ellipse(center, axes, size=SIZE):
    mask = np.zeros((size, size), np.uint8)
    cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)
    return mask


def ct_slice(right=True, left=True, vessel=False):
    """Corte sintético: ar fora do corpo, corpo claro e pulmões escuros."""
    img = np.full((SIZE, SIZE), AIR, np.uint8)
    cv2.ellipse(img, (256, 256), (230, 200), 0, 0, 360, BODY, -1)
    if right:
        img[ellipse(*RIGHT_LUNG) > 0] = LUNG
    if left:
        img[ellipse(*LEFT_LUNG) > 0] = LUNG
    if vessel:
        # vaso claro dentro do pulmão direito (vira buraco na máscara)
        cv2.circle(img, RIGHT_LUNG[0], 8, BODY, -1)
    return img


def png(img):
    ok, buffer = cv2.imencode(".png", img)
    assert ok
    return buffer.tobytes()


def segment(img, gt=None, **form):
    files = {"file": ("corte.png", png(img), "image/png")}
    if gt is not None:
        files["ground_truth"] = ("ref.png", png(gt), "image/png")
    data = {"engine": "cpu", **{k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in form.items()}}
    return client.post("/api/v1/segment", files=files, data=data)


def decode(data_url):
    raw = base64.b64decode(data_url.split(",", 1)[1])
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)


# Contrato
def test_capabilities():
    r = client.get("/api/v1/capabilities")
    assert r.status_code == 200
    assert r.json() == {"gpu": seg.GPU_AVAILABLE}


def test_resposta_tem_todos_os_campos():
    r = segment(ct_slice())
    assert r.status_code == 200
    body = r.json()
    for campo in ("success", "engine", "threshold", "width", "height", "metrics",
                  "mask_url", "right_mask_url", "left_mask_url", "warnings"):
        assert campo in body
    for campo in ("rightArea", "leftArea", "totalArea", "totalTime", "kernelTime",
                  "transferTime", "dice", "iou"):
        assert campo in body["metrics"]
    assert body["success"] is True
    assert body["engine"] == "cpu"
    assert (body["width"], body["height"]) == (SIZE, SIZE)
    assert body["warnings"] == []
    assert body["metrics"]["dice"] is None


# Segmentação
def test_areas_e_convencao_radiologica():
    body = segment(ct_slice()).json()
    m = body["metrics"]
    # o pulmão à esquerda da imagem é o direito do paciente
    assert m["rightArea"] == cv2.countNonZero(ellipse(*RIGHT_LUNG))
    assert m["leftArea"] == cv2.countNonZero(ellipse(*LEFT_LUNG))
    assert m["totalArea"] == m["rightArea"] + m["leftArea"]
    # máscaras separadas batem com as elipses
    assert np.array_equal(decode(body["right_mask_url"]), ellipse(*RIGHT_LUNG))
    assert np.array_equal(decode(body["left_mask_url"]), ellipse(*LEFT_LUNG))
    assert np.array_equal(decode(body["mask_url"]), ellipse(*RIGHT_LUNG) | ellipse(*LEFT_LUNG))


@pytest.mark.parametrize("right,left,lado", [(True, False, "rightArea"), (False, True, "leftArea")])
def test_um_pulmao_so_usa_o_centro_do_corpo(right, left, lado):
    body = segment(ct_slice(right=right, left=left)).json()
    m = body["metrics"]
    assert m[lado] > 0
    assert m["totalArea"] == m[lado]
    assert any("Apenas um lado" in w for w in body["warnings"])


def test_ar_externo_nao_e_pulmao():
    # imagem sem pulmões: o único escuro é o ar que toca a borda
    body = segment(ct_slice(right=False, left=False)).json()
    assert body["metrics"]["totalArea"] == 0
    assert any("Nenhuma" in w for w in body["warnings"])


def test_preenchimento_de_buracos():
    img = ct_slice(vessel=True)
    cheio = segment(img, fill_holes=True).json()["metrics"]
    vazado = segment(img, fill_holes=False).json()["metrics"]
    vaso = cv2.countNonZero(cv2.circle(np.zeros((SIZE, SIZE), np.uint8), RIGHT_LUNG[0], 8, 255, -1))
    assert cheio["rightArea"] == cv2.countNonZero(ellipse(*RIGHT_LUNG))
    assert cheio["rightArea"] - vazado["rightArea"] == vaso
    assert cheio["leftArea"] == vazado["leftArea"]


def test_limiar_automatico_otsu():
    img = ct_slice()
    body = segment(img, threshold=250, auto_threshold=True).json()
    otsu, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    assert body["threshold"] == int(otsu) + 1
    # o slider (250) foi ignorado: com ele, o corpo inteiro viraria "pulmão"
    assert body["metrics"]["totalArea"] == segment(img).json()["metrics"]["totalArea"]


def test_imagem_fora_do_padrao_gera_aviso():
    img = cv2.resize(ct_slice(), (600, 600), interpolation=cv2.INTER_NEAREST)
    body = segment(img).json()
    assert (body["width"], body["height"]) == (600, 600)
    assert any("fora do padrão" in w for w in body["warnings"])


# Dice e IoU
def test_dice_iou_referencia_identica():
    img = ct_slice()
    gt = ellipse(*RIGHT_LUNG) | ellipse(*LEFT_LUNG)
    m = segment(img, gt=gt).json()["metrics"]
    assert m["dice"] == 1.0
    assert m["iou"] == 1.0


def test_dice_iou_referencia_parcial():
    img = ct_slice()
    pred = ellipse(*RIGHT_LUNG) | ellipse(*LEFT_LUNG)
    gt = ellipse(*RIGHT_LUNG)  # referência só com um pulmão
    m = segment(img, gt=gt).json()["metrics"]
    inter = cv2.countNonZero(pred & gt)
    soma = cv2.countNonZero(pred) + cv2.countNonZero(gt)
    assert m["dice"] == pytest.approx(2 * inter / soma, abs=1e-4)
    assert m["iou"] == pytest.approx(inter / (soma - inter), abs=1e-4)


def test_dice_iou_mascaras_vazias():
    vazia = np.zeros((SIZE, SIZE), np.uint8)
    assert seg._dice_iou(vazia, vazia) == (1.0, 1.0)
    assert seg._dice_iou(vazia, ellipse(*LEFT_LUNG)) == (0.0, 0.0)


# Erros
def test_arquivo_invalido():
    r = client.post("/api/v1/segment", files={"file": ("x.png", b"isto nao e imagem", "image/png")})
    assert r.status_code == 400
    assert "decodificar" in r.json()["detail"]


@pytest.mark.parametrize("limiar", [-1, 256, 300])
def test_limiar_fora_da_faixa(limiar):
    r = segment(ct_slice(), threshold=limiar)
    assert r.status_code == 400
    assert "limiar" in r.json()["detail"].lower()


def test_imagem_grande_demais():
    r = segment(np.zeros((8, seg.MAX_SIZE + 1), np.uint8))
    assert r.status_code == 400
    assert str(seg.MAX_SIZE) in r.json()["detail"]


def test_referencia_com_tamanho_diferente():
    r = segment(ct_slice(), gt=np.zeros((256, 256), np.uint8))
    assert r.status_code == 400
    assert "mesmo tamanho" in r.json()["detail"]


def test_referencia_invalida():
    files = {
        "file": ("corte.png", png(ct_slice()), "image/png"),
        "ground_truth": ("ref.png", b"lixo", "image/png"),
    }
    r = client.post("/api/v1/segment", files=files)
    assert r.status_code == 400
    assert "referência" in r.json()["detail"]


def test_sem_arquivo():
    r = client.post("/api/v1/segment", data={"threshold": "120"})
    assert r.status_code == 422


# GPU
def test_gpu_indisponivel_cai_para_cpu(monkeypatch):
    monkeypatch.setattr(seg, "GPU_AVAILABLE", False)
    body = segment(ct_slice(), engine="gpu").json()
    assert body["engine"] == "cpu"
    assert any("GPU indisponível" in w for w in body["warnings"])
    assert body["metrics"]["transferTime"] == 0


@pytest.mark.skipif(not seg.GPU_AVAILABLE, reason="sem GPU disponível")
@pytest.mark.parametrize("limiar", [0, 1, 120, 255])
def test_gpu_igual_a_cpu(limiar):
    img = ct_slice(vessel=True)
    cpu = segment(img, threshold=limiar, fill_holes=False).json()
    gpu = segment(img, threshold=limiar, fill_holes=False, engine="gpu").json()
    assert gpu["engine"] == "gpu"
    assert np.array_equal(decode(cpu["mask_url"]), decode(gpu["mask_url"]))
    assert cpu["metrics"]["totalArea"] == gpu["metrics"]["totalArea"]
