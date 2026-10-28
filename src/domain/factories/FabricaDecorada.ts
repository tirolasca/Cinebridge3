import { FabricaProjeto } from './FabricaProjeto';
import { DadosCriacaoProjeto } from './DadosCriacaoProjeto';
import { Observador, RecomendacaoStrategy, VisitanteProjeto } from './TiposDeFabrica';
import { Projeto } from '../entities/Projeto';

/**
 * Decorator aplicado a uma fábrica: entrega os mesmos validador, notificador
 * e projeto da fábrica original, mas o recomendador sai envolto na pilha de
 * decoradores configurada (e, opcionalmente, no lugar do recomendador padrão
 * da família, quando uma estratégia foi definida explicitamente).
 *
 * É por aqui que a pilha entra no fluxo: o orquestrador e o sistema de
 * recomendação continuam pedindo "o recomendador" à fábrica, sem saber que
 * existe cache, auditoria ou compressão no caminho.
 */
export class FabricaDecorada implements FabricaProjeto {
  constructor(
    private readonly fabrica: FabricaProjeto,
    private readonly decorar: (recomendador: RecomendacaoStrategy) => RecomendacaoStrategy,
    private readonly recomendadorSubstituto?: () => RecomendacaoStrategy
  ) {}

  criarProjeto(dados: DadosCriacaoProjeto): Projeto {
    return this.fabrica.criarProjeto(dados);
  }

  criarValidador(): VisitanteProjeto {
    return this.fabrica.criarValidador();
  }

  criarRecomendador(): RecomendacaoStrategy {
    const base = this.recomendadorSubstituto ? this.recomendadorSubstituto() : this.fabrica.criarRecomendador();
    return this.decorar(base);
  }

  criarNotificador(): Observador {
    return this.fabrica.criarNotificador();
  }
}
