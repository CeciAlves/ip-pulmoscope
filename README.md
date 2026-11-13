# PulmoScope

Protótipo educacional para processamento, segmentação e visualização de imagens médicas (cortes axiais de Tomografia Computadorizada), desenvolvido para fins acadêmicos. O sistema conta com uma interface modular em React, um backend em FastAPI (Python) integrado com OpenCV, e suporte a aceleração por hardware (CUDA).

---

## Como Executar o Projeto

Para rodar a aplicação localmente, você precisará iniciar o **Backend** e o **Frontend** em dois terminais separados.

### Pré-requisitos
* Python 3.10 ou superior instalado.
* Node.js e npm instalados.

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
* **Processamento:** Algoritmos de limiarização e componentes conectados (`connectedComponentsWithStats`) para isolamento pulmonar.

--- 

## Próximos Passos (To-Do)

Melhorias e funcionalidades:

### Processamento de Imagem e Visão Computacional
- [ ] **Refinamento da Separação Anatômica (Esquerdo vs. Direito):** Substituir a atual heurística de divisão por corte seco no eixo X ($cx < width / 2$) por uma abordagem baseada em análise estrutural do mediastino ou alinhamento anatômico, por exemplo, para garantir robustez clínica na classificação dos pulmões.

### 💻 Funcionalidades de Interface e Exportação
- [ ] **Exportação de Métricas em CSV:** Implementar a lógica no painel de resultados para gerar e baixar um relatório estruturado contendo as áreas calculadas e os tempos de processamento do kernel.
- [ ] **Download da Máscara Segmentada:** Habilitar o botão de download para permitir que o usuário salve a máscara binária resultante diretamente em formato PNG.
- [ ] **Validação de Insumos:** Adicionar feedback visual avançado e pré-validação de dimensões para imagens de tomografia de entrada fora do padrão 512x512.