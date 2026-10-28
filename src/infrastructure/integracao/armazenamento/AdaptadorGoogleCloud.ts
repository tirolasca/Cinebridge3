import {
  AdaptadorArmazenamento,
  MetadadosArquivo,
  caminhoDoArquivo,
  metadadosExtras
} from '../../../application/ports/AdaptadorArmazenamento';
import { ArquivoNaoEncontradoError, ErroDeIntegracao } from '../../../application/ports/ErrosDeIntegracao';
import { ClienteGoogleCloudSimulado, ErroGoogleCloud } from './ClienteGoogleCloudSimulado';

/** Adapter: traduz o contrato padronizado de armazenamento para a API do Google Cloud Storage. */
export class AdaptadorGoogleCloud implements AdaptadorArmazenamento {
  readonly provedor = 'google-cloud';

  constructor(
    private readonly cliente: ClienteGoogleCloudSimulado,
    private readonly bucket: string
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const caminho = caminhoDoArquivo(metadados);
    try {
      const { name } = await this.cliente.uploadObject(this.bucket, caminho, conteudo, {
        metadata: { ...metadadosExtras(metadados) }
      });
      return name;
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao enviar o arquivo.', erro);
    }
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      return (await this.cliente.downloadObject(this.bucket, id)).data;
    } catch (erro) {
      if (erro instanceof ErroGoogleCloud && erro.code === 404) {
        throw new ArquivoNaoEncontradoError(`Arquivo não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao recuperar o arquivo.', erro);
    }
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    try {
      const arquivos = await this.cliente.getFiles(this.bucket, { prefix: prefixo });
      return arquivos.map((arquivo) => arquivo.name).sort();
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao listar os arquivos.', erro);
    }
  }
}
