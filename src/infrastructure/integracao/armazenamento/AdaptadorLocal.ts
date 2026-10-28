import { AdaptadorArmazenamento, MetadadosArquivo, caminhoDoArquivo } from '../../../application/ports/AdaptadorArmazenamento';
import { ArquivoNaoEncontradoError } from '../../../application/ports/ErrosDeIntegracao';
import { ArmazenamentoExterno } from './ArmazenamentoExterno';

/**
 * Adapter: traduz o contrato padronizado de armazenamento para o
 * armazenamento local, cuja API é síncrona e não conhece metadados.
 */
export class AdaptadorLocal implements AdaptadorArmazenamento {
  readonly provedor = 'local';

  constructor(private readonly armazenamento: ArmazenamentoExterno) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    return this.armazenamento.upload({ caminho: caminhoDoArquivo(metadados), conteudo });
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      return this.armazenamento.download(id).conteudo;
    } catch {
      throw new ArquivoNaoEncontradoError(`Arquivo não encontrado: ${id}`);
    }
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    return this.armazenamento.listar(prefixo).sort();
  }
}
