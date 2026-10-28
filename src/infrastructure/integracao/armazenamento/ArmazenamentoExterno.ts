export interface ArquivoExterno {
  caminho: string;
  conteudo: Buffer;
}

/**
 * Sistema externo simulado: um armazenamento genérico em disco/memória, com
 * API própria síncrona (`upload`, `download`, `listar`) — é a que o
 * `AdaptadorLocal` traduz para o contrato assíncrono padronizado.
 */
export class ArmazenamentoExterno {
  private readonly arquivos = new Map<string, Buffer>();

  /** Grava o arquivo e devolve o seu identificador (o caminho). */
  upload(arquivo: ArquivoExterno): string {
    this.arquivos.set(arquivo.caminho, Buffer.from(arquivo.conteudo));
    return arquivo.caminho;
  }

  download(id: string): ArquivoExterno {
    const conteudo = this.arquivos.get(id);
    if (!conteudo) throw new Error(`Arquivo inexistente: ${id}`);
    return { caminho: id, conteudo: Buffer.from(conteudo) };
  }

  listar(pasta: string): string[] {
    return Array.from(this.arquivos.keys()).filter((caminho) => caminho.startsWith(pasta));
  }
}
