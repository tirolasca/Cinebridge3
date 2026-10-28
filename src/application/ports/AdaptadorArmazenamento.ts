import { ArgumentoInvalidoError } from './ErrosDeIntegracao';

/** Metadados que acompanham um arquivo enviado ao armazenamento. */
export interface MetadadosArquivo {
  /** Nome do arquivo (obrigatório). */
  nome: string;
  /** "Pasta" lógica, como `projetos/123/`. */
  prefixo?: string;
  tipoConteudo?: string;
  [chave: string]: string | undefined;
}

/**
 * Adapter (alvo): contrato padronizado de armazenamento de arquivos de mídia
 * (roteiros, storyboards, amostras de vídeo). O núcleo do sistema só conhece
 * esta interface; cada provedor (S3, Google Cloud Storage, disco local...) é
 * traduzido para ela por um adaptador.
 *
 * O identificador de um arquivo é o seu caminho (`prefixo + nome`), igual em
 * todos os provedores — por isso trocar de provedor não muda os ids.
 */
export interface AdaptadorArmazenamento {
  /** Nome do provedor em uso (para diagnóstico). */
  readonly provedor: string;
  salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string>;
  /** Lança `ArquivoNaoEncontradoError` se o id não existir. */
  recuperarArquivo(id: string): Promise<Buffer>;
  /** Ids dos arquivos cujo caminho começa com o prefixo, em ordem alfabética. */
  listarArquivos(prefixo: string): Promise<string[]>;
}

/** Caminho do arquivo no armazenamento: prefixo normalizado + nome. */
export function caminhoDoArquivo(metadados: MetadadosArquivo): string {
  const nome = metadados.nome?.trim();
  if (!nome) throw new ArgumentoInvalidoError('O nome do arquivo é obrigatório.');
  if (nome.includes('/') || nome.includes('\\')) throw new ArgumentoInvalidoError('O nome do arquivo não pode conter barras.');

  let prefixo = (metadados.prefixo ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (prefixo.split('/').includes('..')) throw new ArgumentoInvalidoError('O prefixo não pode conter "..".');
  if (prefixo.length > 0 && !prefixo.endsWith('/')) prefixo += '/';

  return `${prefixo}${nome}`;
}

/** Metadados extras (tudo menos nome e prefixo), apenas com valores textuais. */
export function metadadosExtras(metadados: MetadadosArquivo): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(metadados)) {
    if (chave !== 'nome' && chave !== 'prefixo' && valor !== undefined) extras[chave] = valor;
  }
  return extras;
}
