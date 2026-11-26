# PulmoScope

> **Aviso:** ferramenta didática de segmentação. Não possui finalidade diagnóstica e não deve ser usada para decisões clínicas.

Protótipo educacional para processamento, segmentação e visualização de imagens médicas (cortes axiais de Tomografia Computadorizada), desenvolvido para fins acadêmicos (Projeto 19 — Segmentação de Pulmões em Tomografia Computadorizada). Interface modular em React, backend em FastAPI com OpenCV e aceleração opcional por GPU (kernel CUDA próprio).

| Camada | Tecnologias |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4, Lucide Icons |
| Backend | Python, FastAPI, OpenCV, NumPy |
| GPU (opcional) | CuPy (`RawKernel`), kernel em CUDA C |

---

## Como executar

### Pré-requisitos

- Git
- Python 3.10 ou superior
- Node.js 20 ou superior e npm (o Tailwind v4 não funciona no Node 18)
- *(Opcional)* GPU NVIDIA com driver recente, para o motor GPU. No Windows, use o WSL2: o driver fica no Windows e o `nvidia-smi` deve funcionar dentro do WSL.

### 1. Clonar o repositório

```bash
git clone <url-do-repositório>
cd projeto-final-integradores-iv
```

### 2. Backend (FastAPI)

Em um terminal, a partir da raiz do projeto:

```bash
cd backend

# ambiente virtual
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# dependências
pip install --upgrade pip
pip install -r requirements.txt

# servidor (http://localhost:8000; documentação interativa em /docs)
PYTHONPATH=. uvicorn main:app --reload --port 8000
```

No Windows (PowerShell), defina o `PYTHONPATH` antes: `$env:PYTHONPATH="."; uvicorn main:app --reload --port 8000`.

### 3. Frontend (React + Vite)

Em **outro terminal**, a partir da raiz do projeto:

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

O frontend espera a API em `http://localhost:8000`.

### 4. Suporte à GPU (opcional)

```bash
cd backend
source venv/bin/activate
pip install -r requirements-gpu.txt
```

O arquivo instala o CuPy (`cupy-cuda13x`); use `cupy-cuda12x` se o seu driver for CUDA 12. Sem o CuPy ou sem placa NVIDIA, o sistema **continua funcionando**: ao escolher "GPU", a limiarização cai para a CPU e a resposta informa o motor realmente usado.

### Solução de problemas

- **`python: command not found` ou pacotes ausentes:** o ambiente virtual não está ativado (o prompt deve mostrar `(venv)`). No Linux, o comando é `python3` fora do venv.
- **"Erro ao comunicar com o backend":** confirme que o servidor está rodando na porta 8000.
- **GPU indisponível:** verifique `nvidia-smi` e o pacote do CuPy. A aplicação segue na CPU, com um aviso.

---

## Pipeline de segmentação

O sistema transforma a imagem em uma máscara dos pulmões em oito etapas.

1. **Leitura da imagem.** A imagem é aberta em tons de cinza com o OpenCV, de modo que cada pixel passa a ter um único valor, de 0 (preto) a 255 (branco).
2. **Limiarização.** Em seguida, define-se um valor de corte, o *limiar*, e todo pixel mais escuro que ele é marcado, já que o ar dos pulmões aparece escuro na tomografia. Esta é a etapa que roda na GPU (um thread CUDA por pixel) ou na CPU, e o limiar pode ser escolhido pelo usuário ou calculado automaticamente (método de Otsu).
3. **Identificação do corpo.** Como o ar que fica fora do paciente também é escuro, é preciso saber onde o corpo está. Para isso, pega-se tudo o que *não* é escuro (o tecido) e apagam-se as estruturas finas, como a mesa do tomógrafo (operação chamada de abertura morfológica). Depois, fica-se com a maior região restante e preenchem-se os seus buracos. O resultado é a silhueta do corpo, com os pulmões dentro dela.
4. **Separação das regiões escuras.** Os pixels escuros vizinhos são agrupados em regiões (componentes conectados), cada uma com sua área e o seu centro.
5. **Escolha das regiões que são pulmão.** Só ficam as regiões que estão quase inteiramente dentro do corpo, que não são pequenas demais (nem em área absoluta, nem em relação à maior região) e que não estão no terço da frente do corpo, onde fica o gás do estômago e do intestino. Por isso, a quantidade de regiões que sobra varia de corte para corte.
6. **Pulmão direito ou esquerdo.** Traça-se uma linha vertical no meio do corpo, e cada região é atribuída ao lado em que fica o seu centro. As regiões do mesmo lado são somadas. Pela convenção das imagens médicas, o lado esquerdo da imagem mostra o pulmão *direito* do paciente. Se uma região estiver muito perto da linha, a interface avisa que o lado pode estar trocado.
7. **Preenchimento de buracos.** Vasos e nódulos aparecem claros dentro do pulmão e deixariam furos na máscara, por isso os buracos de cada pulmão são preenchidos. Só então os pixels de cada lado são contados, o que dá a área.
8. **Comparação com uma referência (opcional).** Se o usuário enviar uma máscara desenhada por um especialista, o sistema mede o quanto ela coincide com a obtida, usando o Dice e o IoU (1 significa máscaras idênticas, e 0, nenhuma sobreposição).

Os parâmetros (áreas mínimas, frações, tamanho da abertura) são constantes nomeadas no topo de `backend/src/services/segmentation_service.py`.

---

## Decisões de projeto

| Decisão | Motivo |
|---|---|
| Só a **limiarização** roda na GPU | É a etapa naturalmente paralela (um pixel, um thread). Os componentes conectados e os filtros ficam no OpenCV, na CPU. |
| Kernel **CUDA C compilado em execução** (CuPy `RawKernel`) | Mantém o kernel próprio em CUDA C sem exigir uma toolchain C++ separada nem compilação prévia. O código que o lança é Python. |
| **Fallback automático para a CPU** | Quem não tem GPU roda o projeto sem instalar nada extra, e a resposta informa o motor realmente usado. |
| **Aceitar só regiões dentro do corpo**, em vez de descartar as que tocam a borda da imagem | A primeira versão descartava o ar encostado nas bordas, por ser o ar de fora do paciente. Mas a mesa do tomógrafo forma uma "concha" que prende ar sem encostar em borda alguma, e esse ar era confundido com pulmão. Agora o corpo é identificado primeiro, e só o que está dentro dele é aceito. |
| **Manter todas as regiões relevantes**, em vez de apenas as duas maiores | A primeira versão sempre ficava com as duas maiores regiões escuras, supondo um pulmão por região. Em cortes de ápice ou de base, porém, um pulmão pode aparecer em pedaços, ou só um lado pode aparecer. Agora ficam todas as regiões com pelo menos 10% do tamanho da maior, e o resultado pode ter qualquer quantidade de regiões. |
| **Descartar regiões na frente do corpo** | O gás do estômago e do intestino é escuro como o pulmão e fica dentro do corpo, mas na frente do abdômen. Nas amostras, a posição foi o único critério que o separou do pulmão (o tamanho e a textura se sobrepunham). |
| Incluir **vasos e nódulos**, excluir vias aéreas grandes | A máscara delimita onde procurar nódulos; excluí-los os esconderia. |

---

## Atendimento à proposta

### Requisitos mínimos

| Requisito | Situação |
|---|---|
| Kernel de limiarização em CUDA C/C++ | **Atendido.** O kernel `threshold_inv` é escrito em CUDA C. O código que o lança e faz as cópias de memória é Python (CuPy). |
| Selecionar componentes conectados internos e gerar a máscara binária | **Atendido**, com mudança de critério (ver abaixo). |
| Testar diferentes cortes, calcular a área e comparar CPU × GPU | **Atendido.** Galeria com 6 cortes, área em pixels e o script `backend/benchmark.py` para o comparativo. |

### O que mudou em relação à proposta

- **Descarte por borda → pertencer ao corpo.** A proposta descartava as regiões escuras que tocam as bordas da imagem, pois, na maioria dos cortes, só o ar de fora do paciente encosta nelas. Mas em alguns cortes a mesa do tomógrafo se curva e encerra uma bolsa de ar que *não* encosta na borda. Essa bolsa passava pelo filtro, e, por ser grande, era escolhida no lugar de um pulmão menor. O critério passou a ser outro: primeiro se identifica o corpo (apagando a mesa), e só se aceitam regiões que estejam dentro dele. O ar sob a mesa fica fora do corpo e é descartado, esteja ou não encostado na borda.
- **Quantidade de regiões:** passou a depender do tamanho relativo de cada uma, e não de um número fixo.
- **Extras além do pedido:** limiar automático (Otsu), preenchimento de buracos, Dice/IoU, exibição por contorno, exportação (PNG e CSV), galeria de amostras, testes e benchmark.

---

## Resultados da segmentação

A galeria de exemplos da interface (`frontend/public/amostras/`) traz cortes do LUNA16 com a máscara de referência, e Dice e IoU aparecem logo após a segmentação. Dois dos cortes (gás do estômago e ar sob a mesa) são justamente os casos que motivaram os filtros do método.

| Amostra | Regra original (2 maiores, borda) | Regra atual |
|---|---|---|
| Ápice | 0,996 | 0,996 |
| Meio | 0,997 | 0,997 |
| Nódulo | 0,998 | 0,998 |
| Base | 0,977 | 0,977 |
| Falha: gás | 0,598 | 0,962 |
| Falha: mesa | 0,539 | 0,998 |
| **Média (Dice)** | **0,851** | **0,988** |

> São seis cortes, e o filtro de posição foi calibrado neles. Os resultados indicam o comportamento do método, mas não provam que ele generaliza para outros pacientes.

---

## Testes

Testes da API (contrato, segmentação, Dice/IoU e erros) com `pytest` e o `TestClient` do FastAPI, usando imagens sintéticas geradas no próprio teste. Os que comparam GPU × CPU são pulados quando não há GPU.

```bash
cd backend
pip install pytest httpx
python -m pytest tests -v
```

Para repetir o comparativo de desempenho CPU × GPU:

```bash
cd backend
python benchmark.py --tamanhos 512 1024 2048 4096 8192 --csv benchmark.csv
```

---

## Limitações conhecidas

- **Pulmões fundidos:** quando os dois formam um único componente, são tratados como uma região só.
- **Orientação:** o filtro de posição assume a imagem na orientação padrão (paciente de barriga para cima, frente no topo). Uma imagem espelhada ou rotacionada o quebra.
- **Validação pequena:** seis cortes de um mesmo volume; os parâmetros foram ajustados neles.
- **Áreas em pixels**, não em mm²: não são comparáveis entre cortes de resoluções diferentes (a interface avisa quando a imagem foge de 512×512).
- **Latência da GPU após repouso:** depois de cerca de 20 s sem uso, a primeira requisição na GPU pode levar centenas de ms a mais (a placa sai de um estado de baixo consumo). O painel de desempenho mostra só o kernel e a cópia, sem esse custo.
- **URL da API fixa** em `http://localhost:8000` no frontend (`frontend/src/services/api.ts`).

---

## Conclusão

O PulmoScope cumpre o objetivo da proposta: carrega cortes de TC, limiariza a imagem com um kernel CUDA, seleciona as regiões internas ao corpo que correspondem aos pulmões e apresenta a máscara, a sobreposição sobre a imagem original e a área segmentada em pixels. A parte mais delicada do trabalho não foi a limiarização, e sim decidir quais regiões escuras são de fato pulmão. A regra inicial, que descartava o que toca a borda e ficava com as duas maiores regiões, falhava justamente nos cortes em que a mesa do tomógrafo ou o gás do abdômen formavam regiões escuras grandes e internas. Ao trocá-la por critérios baseados no corpo, no tamanho relativo e na posição, o Dice médio nas seis amostras subiu de 0,85 para 0,99, embora essa validação seja pequena e os parâmetros tenham sido ajustados nas próprias amostras.

Na comparação entre CPU e GPU, o resultado foi menos favorável à GPU do que se poderia esperar, e isso é um aprendizado do trabalho. A limiarização é uma operação tão simples, uma comparação por pixel, que o OpenCV na CPU já a executa em frações de milissegundo. O kernel só passa à frente em imagens grandes (cerca de 7 vezes mais rápido em 4096×4096 e 32 vezes em 8192×8192, em medições feitas em uma RTX 3060 sem contar as cópias de memória), e o custo de levar a imagem à placa e trazer a máscara de volta anula esse ganho até tamanhos muito grandes. Em um corte real de 512×512, portanto, a GPU não traz vantagem. Ela só compensaria com imagens maiores, com vários cortes processados em conjunto ou com mais etapas do pipeline rodando nela, de modo a evitar essas idas e vindas de dados. Por isso, a GPU permanece como uma alternativa opcional, com retorno automático para a CPU quando não está disponível.

Por fim, o sistema é uma ferramenta didática: não foi validado clinicamente e não deve ser usado para diagnóstico.

---

Dados de exemplo: [LUNA16](https://luna16.grand-challenge.org/) (CC BY 4.0), derivado do LIDC-IDRI.