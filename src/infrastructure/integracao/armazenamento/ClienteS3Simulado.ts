/** Erro no estilo do SDK da AWS: o código identifica o problema. */
export class ErroS3 extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/**
 * Sistema externo simulado: imita a API do Amazon S3 (buckets, `Key`,
 * `Body`, `Metadata`, respostas em PascalCase), em memória.
 */
export class ClienteS3Simulado {
  private readonly buckets = new Map<string, Map<string, { Body: Buffer; Metadata: Record<string, string> }>>();

  async putObject(entrada: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    Metadata?: Record<string, string>;
    ContentType?: string;
  }): Promise<{ ETag: string }> {
    const bucket = this.buckets.get(entrada.Bucket) ?? new Map();
    this.buckets.set(entrada.Bucket, bucket);
    bucket.set(entrada.Key, {
      Body: Buffer.from(entrada.Body),
      Metadata: { ...entrada.Metadata, ...(entrada.ContentType ? { 'content-type': entrada.ContentType } : {}) }
    });
    return { ETag: `"s3-${entrada.Body.length}-${bucket.size}"` };
  }

  async getObject(entrada: { Bucket: string; Key: string }): Promise<{ Body: Buffer; Metadata: Record<string, string> }> {
    const objeto = this.buckets.get(entrada.Bucket)?.get(entrada.Key);
    if (!objeto) throw new ErroS3('NoSuchKey', `The specified key does not exist: ${entrada.Key}`);
    return { Body: Buffer.from(objeto.Body), Metadata: { ...objeto.Metadata } };
  }

  async listObjectsV2(entrada: { Bucket: string; Prefix?: string }): Promise<{
    Contents: Array<{ Key: string; Size: number }>;
    KeyCount: number;
  }> {
    const bucket = this.buckets.get(entrada.Bucket) ?? new Map();
    const Contents = Array.from(bucket.entries())
      .filter(([Key]) => Key.startsWith(entrada.Prefix ?? ''))
      .map(([Key, objeto]) => ({ Key, Size: objeto.Body.length }));
    return { Contents, KeyCount: Contents.length };
  }
}
