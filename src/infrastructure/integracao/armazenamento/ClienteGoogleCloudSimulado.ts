/** Erro no estilo do cliente do Google Cloud: `code` HTTP numérico. */
export class ErroGoogleCloud extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

/**
 * Sistema externo simulado: imita a API do Google Cloud Storage (objetos
 * identificados por `name`, `generation`, `metadata`, `prefix`), em memória.
 */
export class ClienteGoogleCloudSimulado {
  private readonly buckets = new Map<string, Map<string, { data: Buffer; metadata: Record<string, string>; generation: number }>>();
  private geracao = 0;

  async uploadObject(
    bucket: string,
    nomeDoObjeto: string,
    data: Buffer,
    opcoes: { metadata?: Record<string, string> } = {}
  ): Promise<{ name: string; generation: number }> {
    const objetos = this.buckets.get(bucket) ?? new Map();
    this.buckets.set(bucket, objetos);
    this.geracao += 1;
    objetos.set(nomeDoObjeto, { data: Buffer.from(data), metadata: { ...opcoes.metadata }, generation: this.geracao });
    return { name: nomeDoObjeto, generation: this.geracao };
  }

  async downloadObject(bucket: string, nomeDoObjeto: string): Promise<{ data: Buffer }> {
    const objeto = this.buckets.get(bucket)?.get(nomeDoObjeto);
    if (!objeto) throw new ErroGoogleCloud(404, `No such object: ${bucket}/${nomeDoObjeto}`);
    return { data: Buffer.from(objeto.data) };
  }

  async getFiles(bucket: string, opcoes: { prefix?: string } = {}): Promise<Array<{ name: string; size: number }>> {
    const objetos = this.buckets.get(bucket) ?? new Map();
    return Array.from(objetos.entries())
      .filter(([nome]) => nome.startsWith(opcoes.prefix ?? ''))
      .map(([name, objeto]) => ({ name, size: objeto.data.length }));
  }
}
