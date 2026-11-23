# PulmoScope

> **Aviso:** ferramenta didática de segmentação. Não possui finalidade diagnóstica e não deve ser usada para decisões clínicas.

Protótipo educacional para processamento, segmentação e visualização de imagens médicas (cortes axiais de Tomografia Computadorizada), desenvolvido para fins acadêmicos. O sistema conta com uma interface modular em React, um backend em FastAPI (Python) integrado com OpenCV, e suporte a aceleração por hardware (CUDA).

---

## Como Executar o Projeto

Para rodar a aplicação localmente, você precisará iniciar o **Backend** e o **Frontend** em dois terminais separados.

### Pré-requisitos
* Python 3.10 ou superior instalado.
* Node.js 20 ou superior e npm instalados (o Tailwind v4 não funciona no Node 18).
* (Opcional) GPU NVIDIA com driver recente, para o motor GPU.

---

### 1. Configurando e Rodando o Backend (FastAPI)

Abra um terminal na pasta `backend/`:

```bash
cd backend

# 1. Crie o ambiente virtual do Python
python3 -m venv venv

# 2. Ative o ambiente virtual (Linux/macOS)
source venv/bin/activate

# 3. Instale as dependências
pip install --upgrade pip
pip install -r requirements.txt

# (opcional) suporte à GPU: kernel CUDA compilado em tempo de execução pelo CuPy.
# Use o pacote compatível com o seu driver (cupy-cuda13x ou cupy-cuda12x).
pip install -r requirements-gpu.txt

# 4. Inicie o servidor FastAPI
PYTHONPATH=. uvicorn main:app --reload --port 8000
```

O servidor estará rodando em `http://localhost:8000`. Você pode acessar a documentação interativa da API em `http://localhost:8000/docs`.

---

### 2. Configurando e Rodando o Frontend (React + Vite)

Abra **outro terminal** na pasta `frontend/`:

```bash
cd frontend

# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm run dev
```

O frontend abrirá no navegador (geralmente em `http://localhost:5173`).

---

## Tecnologias Utilizadas
* **Frontend:** React, Tailwind CSS v4, Lucide Icons, Vite.
* **Backend:** Python, FastAPI, OpenCV, NumPy.
* **Processamento:** Limiarização com kernel próprio em CUDA C (via `cupy.RawKernel`) ou `cv2.threshold` (OpenCV) na CPU, componentes conectados (`connectedComponentsWithStats`) para isolamento pulmonar, limiar automático por Otsu e preenchimento de buracos.

## Pipeline de Segmentação

1. Leitura da imagem em tons de cinza com OpenCV.
2. Limiarização invertida (`pixel < T → 255`): na GPU, um thread CUDA por pixel (blocos 16×16), com tempos de cópia (H2D/D2H) e de kernel medidos por eventos CUDA. Sem GPU, cai automaticamente para a CPU.
3. Componentes conectados (vizinhança 8); descarte dos que tocam a borda (ar fora do corpo) e dos menores que a área mínima.
4. Seleção dos dois maiores componentes internos (os pulmões).
5. Separação direito × esquerdo: com dois pulmões, o de centróide mais à esquerda na imagem é o **direito do paciente** (convenção radiológica); com um só, a comparação é feita com o centro do corpo, não com o centro da imagem.
6. Preenchimento de buracos (vasos) em cada pulmão e cálculo da área em pixels.
7. (Opcional) Se uma máscara de referência for enviada (PNG do mesmo tamanho), calcula **Dice** e **IoU** da máscara dos dois pulmões contra ela.

## Dados (LUNA16) e Avaliação

O LUNA16 distribui volumes 3D (`.mhd`/`.raw`, em HU), e a aplicação trabalha com cortes 8 bits. A conversão é feita uma vez, fora da aplicação, pelo script `backend/luna16.py` (requer `pip install SimpleITK`):

```bash
cd backend
# converte os volumes em cortes PNG (janela de -1000 a 400 HU) + máscaras de referência
# (rótulos 3 e 4 do seg-lungs-LUNA16). Extrai ápice, região média e base de cada volume
# e, com annotations.csv, também os cortes que passam pelos nódulos.
python luna16.py preparar --volumes ~/LUNA16/subset0 \
    --mascaras ~/LUNA16/seg-lungs-LUNA16 --anotacoes ~/LUNA16/annotations.csv \
    --saida ~/LUNA16/processado --limite 10

# segmenta todos os cortes preparados e calcula Dice e IoU (média, desvio e mínimo)
python luna16.py avaliar --dados ~/LUNA16/processado --motor gpu --csv avaliacao.csv

# procura o limiar de maior Dice médio (escolhido em metade dos volumes, medido na outra)
python luna16.py buscar --dados ~/LUNA16/processado --de 60 --ate 180 --passo 5
```

A interface já traz uma **galeria de cortes de exemplo** (`frontend/public/amostras/`): ápice, meio, base e um corte com nódulo de um mesmo volume do LUNA16, além de dois casos em que o método falha (gás do estômago confundido com pulmão e ar sob a mesa do tomógrafo). Todos vêm com a máscara de referência, então Dice e IoU aparecem logo após a segmentação. Os cortes são do [LUNA16](https://luna16.grand-challenge.org/) (licença CC BY 4.0), derivado do LIDC-IDRI.

A saída tem `imagens/` e `mascaras/` com o mesmo nome de arquivo. Na interface, carregue um corte e, em seguida, a máscara correspondente em **Máscara de referência** para ver Dice e IoU daquele corte.

## Testes

Testes da API (contrato, segmentação, Dice/IoU e erros) com `pytest` e o `TestClient` do FastAPI, usando imagens sintéticas geradas no próprio teste. Os que comparam GPU × CPU são pulados quando não há GPU.

```bash
cd backend
pip install pytest httpx
python -m pytest tests -v
```

## Benchmark CPU × GPU

O script `backend/benchmark.py` compara três implementações da limiarização: **CPU-A** `cv2.threshold` (OpenCV, motor de CPU da API), **CPU-B** NumPy (vetorizado, sem OpenCV) e **GPU** (o kernel CUDA da API). Cenários: (1) só o kernel, sem cópias, medido por eventos CUDA; (2) kernel com cópias H2D + D2H; (3) pipeline completo da API, por parte; (4) escalabilidade com a imagem redimensionada. Descarta o aquecimento, executa N vezes (padrão 100) e reporta média, desvio, mínimo, mediana e speedup em relação ao OpenCV, além da diferença de pixels entre as máscaras (sempre 0).

```bash
cd backend
python benchmark.py --tamanhos 512 1024 2048 4096 8192 --csv benchmark.csv
# cenário 3 com cortes reais (até 20 PNGs da pasta)
python benchmark.py --imagens ~/LUNA16/processado/imagens
```

Resultados de referência (RTX 3060 12 GB, driver 535, máquina sem outras cargas; medianas em ms, 100 execuções; speedup em relação ao OpenCV):

| Tamanho | CPU-A OpenCV | CPU-B NumPy | GPU só kernel | Cópias H2D + D2H | GPU kernel + cópias |
|---|---|---|---|---|---|
| 512² | 0,0076 | 0,257 | 0,0072 (1,0×) | 0,125 | 0,134 (0,06×) |
| 1024² | 0,0150 | 1,18 | 0,0145 (1,0×) | 0,362 | 0,376 (0,04×) |
| 2048² | 0,106 | 8,17 | 0,062 (1,7×) | 1,12 | 1,18 (0,09×) |
| 4096² | 1,61 | 30,9 | 0,232 (7,0×) | 4,80 | 5,03 (0,32×) |
| 8192² | 29,1 | 172 | 0,916 (31,8×) | 23,6 | 24,5 (1,19×) |

Pipeline completo da API em 20 cortes do LUNA16 (512², mediana de 400 execuções): **CPU 2,94 ms × GPU 3,18 ms**. A limiarização é menos de 1% do tempo; o resto (componentes conectados, separação e buracos) roda na CPU nos dois motores.

Leitura:
- **Só o kernel**, a GPU empata com o OpenCV até 1024² e passa à frente a partir de 2048² (≈ 7× em 4096², ≈ 32× em 8192²).
- **Com as cópias**, a GPU perde até 4096²: limiarizar é uma operação trivial (uma comparação por pixel), e copiar a imagem para a GPU e trazer a máscara de volta custa de 15 a 25 vezes mais do que processá-la. Só em 8192² ela compensa, e por pouco (1,19×).
- No tamanho real de uma TC (512²), a GPU deixa o pipeline um pouco **mais lento**. Ela valeria a pena com imagens muito grandes, com lotes de cortes ou se mais etapas (ex.: componentes conectados) rodassem nela, evitando idas e vindas de dados.
- O OpenCV é muito mais rápido que o NumPy por ser multithread e usar instruções SIMD.
- Todas as máscaras são idênticas entre os motores (diferença de 0 pixel em todos os tamanhos).

--- 

## Próximos Passos (To-Do)

Melhorias e funcionalidades:

### Processamento de Imagem e Visão Computacional
- [x] **Refinamento da Separação Anatômica (Esquerdo vs. Direito):** a divisão por corte seco no eixo X foi substituída pela classificação por componente (centróides relativos entre si e ao centro do corpo), e o backend devolve uma máscara por pulmão.
- [x] **Limiar automático (Otsu)** e **preenchimento de buracos**, configuráveis na interface.
- [x] **Preparação do LUNA16:** volumes `.mhd` convertidos em cortes PNG com máscaras de referência.
- [x] **Métricas Dice e IoU** contra a máscara de referência, na interface e em lote (`luna16.py avaliar`).
- [x] **Galeria de amostras** do LUNA16 com máscaras de referência, incluindo casos de falha.
- [x] **Benchmark CPU × GPU** (`backend/benchmark.py`), com escalabilidade e verificação de pixels.
- [x] **Testes da API** (`backend/tests`): 25 casos cobrindo contrato, convenção radiológica, buracos, Otsu, Dice/IoU, erros 400/422 e GPU × CPU.
- [ ] **Separação de pulmões fundidos:** quando os dois pulmões formam um único componente, ainda são tratados como uma região só.

### Funcionalidades de Interface e Exportação
- [x] **Exportação de Métricas em CSV:** áreas, limiar, motor usado e tempos de processamento.
- [x] **Download da Máscara Segmentada e da Sobreposição** em PNG (respeitando o filtro de pulmão e o modo de exibição).
- [x] **Exibição por contorno:** a máscara pode ser vista preenchida ou só pela borda (contorno interno, sem deslocar a fronteira do pulmão), na tela e nos downloads.
- [x] **Validação de Insumos:** pré-validação de formato, tamanho e dimensões no frontend, com aviso para imagens fora do padrão 512×512; o backend repete a validação.
- [x] **Re-segmentação automática** ao ajustar o limiar (com debounce).
