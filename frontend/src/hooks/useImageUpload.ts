/**
 * useImageUpload.ts
 * Hook que gerencia a imagem carregada pelo usuário: validação do formato,
 * URL de pré-visualização, imagem de exemplo, remoção e mensagens de erro.
 */

import { useState, useEffect } from 'react';

// Constantes

// formatos de imagem aceitos no upload
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
// tamanho máximo do arquivo (MB)
const MAX_FILE_SIZE_MB = 15;
// maior dimensão aceita pelo backend e tamanho padrão de um corte de TC
const MAX_DIMENSION = 4096;
const EXPECTED_DIMENSION = 512;

// lê as dimensões reais da imagem a partir da url blob
function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Imagem inválida.'));
    img.src = url;
  });
}

export function useImageUpload() {
  // Estado
  // url temporária (blob) usada para exibir a imagem
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  // nome do arquivo exibido na interface
  const [imageName, setImageName] = useState('');
  // mensagem de erro de validação ou carregamento
  const [errorMessage, setErrorMessage] = useState('');
  // aviso não bloqueante (ex.: imagem fora do padrão 512x512)
  const [inputWarning, setInputWarning] = useState('');

  // Limpeza de memória
  // libera a url blob anterior quando a imagem muda ou o componente desmonta
  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Handlers
  // valida o arquivo escolhido e gera a pré-visualização;
  // retorna true se a imagem foi aceita
  async function handleImageSelection(file?: File): Promise<boolean> {
    if (!file) return false;

    setErrorMessage('');
    setInputWarning('');

    // rejeita formatos fora da lista aceita
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage('Formato inválido. Selecione uma imagem PNG ou JPEG.');
      return false;
    }

    // rejeita arquivos grandes demais
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`Arquivo maior que ${MAX_FILE_SIZE_MB} MB.`);
      return false;
    }

    const previewUrl = URL.createObjectURL(file);

    // pré-validação das dimensões (antes de enviar ao backend)
    try {
      const { width, height } = await readImageSize(previewUrl);
      if (Math.max(width, height) > MAX_DIMENSION) {
        URL.revokeObjectURL(previewUrl);
        setErrorMessage(`Imagem ${width}×${height} maior que o limite de ${MAX_DIMENSION} px.`);
        return false;
      }
      if (width !== EXPECTED_DIMENSION || height !== EXPECTED_DIMENSION) {
        setInputWarning(
          `Imagem ${width}×${height}: fora do padrão ${EXPECTED_DIMENSION}×${EXPECTED_DIMENSION} de TC. A segmentação funciona, mas a área em pixels não é comparável com outros cortes.`
        );
      }
    } catch {
      URL.revokeObjectURL(previewUrl);
      setErrorMessage('Não foi possível ler a imagem selecionada.');
      return false;
    }

    setImagePreviewUrl(previewUrl);
    setImageName(file.name);
    return true;
  }

  // carrega um corte de exemplo da pasta public; retorna true se foi aceito
  async function handleLoadSample(url: string, fileName: string): Promise<boolean> {
    setErrorMessage('');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Arquivo de imagem não encontrado.');
      }

      // converte a resposta em File para seguir o mesmo fluxo de um upload
      const blob = await response.blob();
      const sampleFile = new File([blob], fileName, { type: 'image/png' });

      // segue o mesmo fluxo (e as mesmas validações) de um upload
      return await handleImageSelection(sampleFile);
    } catch (error) {
      console.error('Erro ao carregar o corte de exemplo:', error);
      setErrorMessage('Não foi possível carregar o corte de exemplo.');
      return false;
    }
  }

  // limpa a imagem, o nome e o erro
  function handleRemoveImage() {
    setImagePreviewUrl(null);
    setImageName('');
    setErrorMessage('');
    setInputWarning('');
  }

  // Retorno
  return {
    imagePreviewUrl,
    imageName,
    errorMessage,
    inputWarning,
    // atalho booleano para saber se há imagem carregada
    hasImage: Boolean(imagePreviewUrl),
    handleImageSelection,
    handleLoadSample,
    handleRemoveImage,
    setErrorMessage,
  };
}