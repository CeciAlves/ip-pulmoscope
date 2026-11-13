/**
 * ImageUpload.tsx
 * Área de entrada da imagem: clique ou arraste para enviar, botão de imagem
 * demonstrativa e cartão com o arquivo carregado. A validação do formato
 * é feita no hook useImageUpload.
 */

import { useRef } from 'react';
import { CheckCircle2, FileImage, Upload, X } from 'lucide-react';

// Props
interface ImageUploadProps {
  // nome do arquivo carregado
  imageName: string;
  // true quando há imagem carregada
  hasImage: boolean;
  // mensagem de erro de validação ou carregamento
  errorMessage: string;
  // callbacks de ação do usuário
  onImageSelected: (file: File) => void;
  // pode ser assíncrono (carrega a imagem de exemplo)
  onLoadSample: () => void | Promise<void>;
  onRemoveImage: () => void;
}

export function ImageUpload({
  imageName,
  hasImage,
  errorMessage,
  onImageSelected,
  onLoadSample,
  onRemoveImage,
}: ImageUploadProps) {
  // referência do input de arquivo (oculto), acionado pelo clique na área
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  // seleção pelo explorador de arquivos
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelected(file);
    }
    // limpa o input para permitir escolher o mesmo arquivo novamente
    event.target.value = '';
  }

  // seleção por arrastar e soltar
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    // evita que o navegador abra o arquivo em outra aba
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onImageSelected(file);
    }
  }

  return (
    <section className="space-y-3">
      <h2
        className="text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        1. Imagem de entrada
      </h2>

      {/* Área de upload (clique, teclado ou arrastar e soltar) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // evita a rolagem da página ao pressionar espaço
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        // necessário para permitir o drop
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="group cursor-pointer rounded-xl border border-dashed p-5 text-center transition"
        style={{
          backgroundColor: 'var(--color-bg-base)',
          borderColor: 'var(--color-border)',
        }}
      >
        <Upload
          className="mx-auto mb-2.5 h-6 w-6 transition-transform group-hover:-translate-y-0.5"
          style={{ color: 'var(--color-soft-blue)' }}
        />

        <p className="text-xs font-semibold">Insira uma imagem PNG ou JPEG</p>

        <p
          className="mt-1 text-[11px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Corte axial de TC
        </p>

        {/* input real, oculto: o clique na área acima o aciona */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Imagem demonstrativa */}
      <button
        type="button"
        onClick={onLoadSample}
        className="flex items-center gap-2 text-xs font-medium transition hover:opacity-80"
        style={{ color: 'var(--color-soft-blue)' }}
      >
        <FileImage className="h-3.5 w-3.5" />
        Carregar imagem demonstrativa
      </button>

      {/* Cartão do arquivo carregado, com botão de remover */}
      {hasImage && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--color-olive-green)' }}
            />
            <span className="truncate text-xs">{imageName}</span>
          </div>

          <button
            type="button"
            onClick={onRemoveImage}
            title="Remover imagem"
            className="shrink-0 rounded p-0.5 transition hover:bg-white/10"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Mensagem de erro */}
      {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
    </section>
  );
}