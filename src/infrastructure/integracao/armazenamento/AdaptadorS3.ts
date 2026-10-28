import {
  AdaptadorArmazenamento,
  MetadadosArquivo,
  caminhoDoArquivo,
  metadadosExtras
} from '../../../application/ports/AdaptadorArmazenamento';
import { ArquivoNaoEncontradoError, ErroDeIntegracao } from '../../../application/ports/ErrosDeIntegracao';
import { ClienteS3Simulado, ErroS3 } from './ClienteS3Simulado';

/** Adapter: traduz o contrato padronizado de armazenamento para a API do Amazon S3. */
export class AdaptadorS3 implements AdaptadorArmazenamento {
  readonly provedor = 's3';

  constructor(
    private readonly cliente: ClienteS3Simulado,
    private readonly bucket: string
  ) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const caminho = caminhoDoArquivo(metadados);
    try {
      await this.cliente.putObject({
        Bucket: this.bucket,
        Key: caminho,
        Body: conteudo,
        Metadata: metadadosExtras(metadados),
        ContentType: metadados.tipoConteudo
      });
      return caminho;
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao enviar o arquivo.', erro);
    }
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    try {
      return (await this.cliente.getObject({ Bucket: this.bucket, Key: id })).Body;
    } catch (erro) {
      if (erro instanceof ErroS3 && erro.code === 'NoSuchKey') {
        throw new ArquivoNaoEncontradoError(`Arquivo não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao recuperar o arquivo.', erro);
    }
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    try {
      const { Contents } = await this.cliente.listObjectsV2({ Bucket: this.bucket, Prefix: prefixo });
      return Contents.map((objeto) => objeto.Key).sort();
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao listar os arquivos.', erro);
    }
  }
}
