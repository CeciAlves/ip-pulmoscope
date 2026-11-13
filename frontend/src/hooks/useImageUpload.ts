/**
 * useImageUpload.ts
 * Hook que gerencia a imagem carregada pelo usuário: validação do formato,
 * URL de pré-visualização, imagem de exemplo, remoção e mensagens de erro.
 */

import { useState, useEffect } from 'react';

// Constantes

// formatos de imagem aceitos no upload
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

export function useImageUpload() {
  // Estado
  // url temporária (blob) usada para exibir a imagem
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  // nome do arquivo exibido na interface
  const [imageName, setImageName] = useState('');
  // mensagem de erro de validação ou carregamento
  const [errorMessage, setErrorMessage] = useState('');

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
  // valida o arquivo escolhido e gera a pré-visualização
  function handleImageSelection(file?: File) {
    if (!file) return;

    setErrorMessage('');

    // rejeita formatos fora da lista aceita
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage('Formato inválido. Selecione uma imagem PNG ou JPEG.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageName(file.name);
  }

  // carrega a imagem de exemplo que fica na pasta public
  async function handleLoadSample() {
    setErrorMessage('');

    try {
      const response = await fetch('/image-example.png');
      if (!response.ok) {
        throw new Error('Arquivo de imagem não encontrado.');
      }

      // converte a resposta em File para seguir o mesmo fluxo de um upload
      const blob = await response.blob();
      const sampleFile = new File([blob], 'image-example.png', { type: 'image/png' });

      const previewUrl = URL.createObjectURL(sampleFile);
      setImagePreviewUrl(previewUrl);
      setImageName('image-example.png');
    } catch (error) {
      console.error('Erro ao carregar imagem demonstrativa:', error);
      setErrorMessage('Não foi possível carregar a imagem demonstrativa.');
    }
  }

  // limpa a imagem, o nome e o erro
  function handleRemoveImage() {
    setImagePreviewUrl(null);
    setImageName('');
    setErrorMessage('');
  }

  // Retorno
  return {
    imagePreviewUrl,
    imageName,
    errorMessage,
    // atalho booleano para saber se há imagem carregada
    hasImage: Boolean(imagePreviewUrl),
    handleImageSelection,
    handleLoadSample,
    handleRemoveImage,
    setErrorMessage,
  };
}