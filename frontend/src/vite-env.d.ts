/**
 * vite-env.d.ts
 * Declarações de tipos do ambiente Vite. Não gera código em tempo de
 * execução, só informa ao TypeScript o que o Vite adiciona ao projeto.
 */

// tipos do Vite (import.meta.env, imports de assets etc.)
/// <reference types="vite/client" />

// permite importar arquivos .css no TypeScript
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}