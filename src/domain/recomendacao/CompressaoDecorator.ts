import { gunzipSync, gzipSync } from 'node:zlib';
import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';
import { RecomendadorDecorator } from './RecomendadorDecorator';

/** Representação transmissível de um profissional recomendado. */
export interface ProfissionalNaCarga {
  id: string;
  nome: string;
  especialidadePrincipal: string;
  faixaDePreco: { minimo: number; maximo: number };
  localizacao: { latitude: number; longitude: number; cidade: string };
  historicoProjetos: string[];
  competencias: Array<{ nome: string; nivel: number }>;
  avaliacoes: Array<{ nota: number; projetoId: string }>;
}

/** Equipe serializada: papel -> profissional. */
export type CargaDeEquipe = Record<string, ProfissionalNaCarga>;

export interface ResumoDeCompressao {
  readonly chamadas: number;
  readonly bytesOriginais: number;
  readonly bytesComprimidos: number;
  /** Fração economizada (0,75 = 75% menor). Negativa se a compressão aumentou o tamanho. */
  readonly taxaDeCompressao: number;
}

/** Acumula os tamanhos antes/depois da compressão; compartilhável entre decoradores. */
export class EstatisticasDeCompressao {
  private chamadas = 0;
  private bytesOriginais = 0;
  private bytesComprimidos = 0;

  registrar(original: number, comprimido: number): void {
    this.chamadas += 1;
    this.bytesOriginais += original;
    this.bytesComprimidos += comprimido;
  }

  resumo(): ResumoDeCompressao {
    return {
      chamadas: this.chamadas,
      bytesOriginais: this.bytesOriginais,
      bytesComprimidos: this.bytesComprimidos,
      taxaDeCompressao: this.bytesOriginais > 0 ? 1 - this.bytesComprimidos / this.bytesOriginais : 0
    };
  }
}

export function montarCarga(equipe: Map<string, Profissional>): CargaDeEquipe {
  const carga: CargaDeEquipe = {};
  for (const [papel, profissional] of equipe.entries()) {
    carga[papel] = {
      id: profissional.id,
      nome: profissional.nome,
      especialidadePrincipal: profissional.especialidadePrincipal,
      faixaDePreco: profissional.faixaDePreco,
      localizacao: profissional.localizacao,
      historicoProjetos: [...profissional.historicoProjetosSeguro],
      competencias: profissional.competenciasSeguras.map((c) => ({ nome: c.nome, nivel: c.nivel })),
      avaliacoes: profissional.avaliacoesSeguras.map((a) => ({ nota: a.nota, projetoId: a.projetoId }))
    };
  }
  return carga;
}

/**
 * Decorator: comprime (gzip) a representação serializada do resultado — a
 * forma em que ele seria transmitido a outros serviços — e registra o quanto
 * isso economizou.
 *
 * Como a interface `RecomendacaoStrategy` não muda, o valor devolvido a quem
 * chamou continua sendo o mesmo mapa de profissionais; a carga comprimida
 * fica disponível em `ultimaCarga()`, e `descomprimir()` faz o caminho de
 * volta. Cargas muito pequenas podem não encolher (o gzip acrescenta um
 * cabeçalho fixo); a taxa registrada reflete sempre os tamanhos reais.
 */
export class CompressaoDecorator extends RecomendadorDecorator {
  readonly nome = 'compressao';
  private carga?: Buffer;

  constructor(
    interno: RecomendacaoStrategy,
    private readonly estatisticas: EstatisticasDeCompressao = new EstatisticasDeCompressao()
  ) {
    super(interno);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional> {
    const resultado = this.interno.recomendar(projeto, profissionais);

    const original = Buffer.from(JSON.stringify(montarCarga(resultado)), 'utf8');
    this.carga = gzipSync(original);
    this.estatisticas.registrar(original.length, this.carga.length);

    return resultado;
  }

  /** Carga comprimida (gzip) da última recomendação. */
  ultimaCarga(): Buffer | undefined {
    return this.carga;
  }

  resumo(): ResumoDeCompressao {
    return this.estatisticas.resumo();
  }

  static descomprimir(carga: Buffer): CargaDeEquipe {
    return JSON.parse(gunzipSync(carga).toString('utf8')) as CargaDeEquipe;
  }
}
