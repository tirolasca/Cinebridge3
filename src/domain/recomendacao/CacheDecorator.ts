import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';
import { RecomendadorDecorator } from './RecomendadorDecorator';

type Equipe = Map<string, Profissional>;

export interface EstatisticasDeCache {
  readonly entradas: number;
  readonly acertos: number;
  readonly erros: number;
}

export interface OpcoesDoCache {
  /** Tempo de vida de cada entrada, em milissegundos (padrão: 5 minutos). */
  ttlMs?: number;
  /** Quantidade máxima de entradas; ao estourar, a menos usada recentemente sai (padrão: 500). */
  capacidade?: number;
  /** Relógio injetável, para testes (padrão: Date.now). */
  relogio?: () => number;
}

/**
 * Armazenamento em memória dos resultados em cache, com expiração e limite de
 * tamanho. É compartilhado entre as chamadas: cada requisição cria os seus
 * decoradores, mas todos consultam e preenchem o mesmo armazenamento.
 */
export class ArmazenamentoDeCache {
  private readonly entradas = new Map<string, { valor: Equipe; expiraEm: number }>();
  private acertos = 0;
  private erros = 0;
  private readonly ttlMs: number;
  private readonly capacidade: number;
  private readonly relogio: () => number;

  constructor(opcoes: OpcoesDoCache = {}) {
    this.ttlMs = opcoes.ttlMs ?? 5 * 60 * 1000;
    this.capacidade = opcoes.capacidade ?? 500;
    this.relogio = opcoes.relogio ?? Date.now;
  }

  obter(chave: string): Equipe | undefined {
    const entrada = this.entradas.get(chave);
    if (!entrada || entrada.expiraEm <= this.relogio()) {
      if (entrada) this.entradas.delete(chave);
      this.erros += 1;
      return undefined;
    }
    this.acertos += 1;
    // Reinsere para marcar como a mais recentemente usada.
    this.entradas.delete(chave);
    this.entradas.set(chave, entrada);
    return new Map(entrada.valor);
  }

  guardar(chave: string, valor: Equipe): void {
    this.entradas.delete(chave);
    while (this.entradas.size >= this.capacidade) {
      const maisAntiga = this.entradas.keys().next().value as string;
      this.entradas.delete(maisAntiga);
    }
    this.entradas.set(chave, { valor: new Map(valor), expiraEm: this.relogio() + this.ttlMs });
  }

  estatisticas(): EstatisticasDeCache {
    return { entradas: this.entradas.size, acertos: this.acertos, erros: this.erros };
  }

  limpar(): void {
    this.entradas.clear();
    this.acertos = 0;
    this.erros = 0;
  }
}

/** Gera a chave de cache de uma chamada. */
export type GeradorDeChave = (projeto: Projeto, profissionais: Profissional[], interno: RecomendacaoStrategy) => string;

/**
 * Chave padrão: dois projetos são "similares" quando têm o mesmo tipo, o
 * mesmo orçamento, os mesmos papéis com os mesmos pesos e o mesmo conjunto de
 * candidatos. Título, datas, produtor e localização não entram na chave —
 * projetos que só diferem nesses campos reaproveitam o mesmo resultado.
 */
export const chaveDeProjetosSimilares: GeradorDeChave = (projeto, profissionais, interno) =>
  JSON.stringify({
    recomendador: interno.constructor.name,
    tipo: projeto.tipoProjeto,
    orcamento: projeto.orcamentoTotal,
    papeis: projeto.papeisRequeridos
      .map((p) => [p.papel, Number(p.pesoImportancia.toFixed(4))] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
    candidatos: profissionais.map((p) => p.id).sort()
  });

/**
 * Decorator: antes de delegar ao recomendador interno, procura no cache um
 * resultado já calculado para um projeto similar; só chama o recomendador
 * interno (e guarda o resultado) quando não encontra.
 */
export class CacheDecorator extends RecomendadorDecorator {
  readonly nome = 'cache';

  constructor(
    interno: RecomendacaoStrategy,
    private readonly cache: ArmazenamentoDeCache,
    private readonly gerarChave: GeradorDeChave = chaveDeProjetosSimilares
  ) {
    super(interno);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Equipe {
    const chave = this.gerarChave(projeto, profissionais, this.interno);

    const emCache = this.cache.obter(chave);
    if (emCache) return emCache;

    const resultado = this.interno.recomendar(projeto, profissionais);
    this.cache.guardar(chave, resultado);
    return resultado;
  }
}
