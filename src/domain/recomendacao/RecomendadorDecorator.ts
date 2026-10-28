import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';

/**
 * Decorator (base): implementa a mesma interface `RecomendacaoStrategy` do
 * objeto que envolve e recebe esse objeto no construtor. Cada decorador
 * concreto acrescenta uma única preocupação transversal antes e/ou depois de
 * delegar ao recomendador interno — e, por ter a mesma interface, pode ser
 * empilhado sobre outros decoradores, em qualquer ordem.
 */
export abstract class RecomendadorDecorator implements RecomendacaoStrategy {
  /** Nome curto do decorador, usado na configuração da pilha e nos diagnósticos. */
  abstract readonly nome: string;

  constructor(protected readonly interno: RecomendacaoStrategy) {}

  abstract recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional>;
}
