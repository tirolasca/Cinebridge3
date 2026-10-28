import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { ArmazenamentoDeCache, CacheDecorator } from './CacheDecorator';
import { AuditoriaDecorator, RegistradorDeAuditoria } from './AuditoriaDecorator';
import { CompressaoDecorator, EstatisticasDeCompressao } from './CompressaoDecorator';

/** Cria um decorador envolvendo o recomendador recebido. */
export type FabricaDeDecorador = (interno: RecomendacaoStrategy) => RecomendacaoStrategy;

/** Pilha de decoradores solicitada com nomes que não existem no registro. */
export class PilhaDeDecoradoresInvalidaError extends Error {}

/**
 * Monta, em tempo de execução, a pilha de decoradores que envolve um
 * recomendador. A pilha é uma lista de nomes na ordem em que os decoradores
 * são aplicados: o primeiro envolve o recomendador base (fica mais "por
 * dentro") e o último fica por fora, recebendo a chamada primeiro.
 *
 *   ['cache', 'auditoria', 'compressao']  =>  compressao( auditoria( cache( base ) ) )
 *
 * Novos decoradores entram com `registrar()`; nenhuma outra classe precisa
 * mudar.
 */
export class ConstrutorDePilhaDeRecomendacao {
  private readonly registro = new Map<string, FabricaDeDecorador>();

  registrar(nome: string, fabrica: FabricaDeDecorador): this {
    this.registro.set(nome, fabrica);
    return this;
  }

  nomesDisponiveis(): string[] {
    return Array.from(this.registro.keys());
  }

  /** Lança erro se algum nome não estiver registrado. */
  validar(nomes: readonly string[]): void {
    const desconhecidos = nomes.filter((nome) => !this.registro.has(nome));
    if (desconhecidos.length > 0) {
      throw new PilhaDeDecoradoresInvalidaError(
        `Decorador(es) desconhecido(s): ${desconhecidos.join(', ')}. Disponíveis: ${this.nomesDisponiveis().join(', ')}.`
      );
    }
  }

  construir(base: RecomendacaoStrategy, nomes: readonly string[]): RecomendacaoStrategy {
    this.validar(nomes);
    return nomes.reduce<RecomendacaoStrategy>((interno, nome) => this.registro.get(nome)!(interno), base);
  }
}

export interface DependenciasDaPilhaPadrao {
  cache: ArmazenamentoDeCache;
  auditoria: RegistradorDeAuditoria;
  compressao: EstatisticasDeCompressao;
}

/** Construtor com os três decoradores do serviço (cache, auditoria e compressão) já registrados. */
export function criarConstrutorPadrao(dependencias: DependenciasDaPilhaPadrao): ConstrutorDePilhaDeRecomendacao {
  return new ConstrutorDePilhaDeRecomendacao()
    .registrar('cache', (interno) => new CacheDecorator(interno, dependencias.cache))
    .registrar('auditoria', (interno) => new AuditoriaDecorator(interno, dependencias.auditoria))
    .registrar('compressao', (interno) => new CompressaoDecorator(interno, dependencias.compressao));
}
