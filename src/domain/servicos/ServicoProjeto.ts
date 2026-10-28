import type { ServicoAtomico } from './ServicoAtomico';

/** Resultado da validação recursiva de uma hierarquia de serviços. */
export interface ResultadoValidacaoServico {
  readonly valido: boolean;
  readonly erros: string[];
}

/** Como os subserviços de um pacote se encadeiam no tempo. */
export enum ModoExecucao {
  /** Um após o outro: o prazo do pacote é a soma dos prazos. */
  SEQUENCIAL = 'SEQUENCIAL',
  /** Ao mesmo tempo: o prazo do pacote é o do subserviço mais demorado. */
  PARALELO = 'PARALELO'
}

/**
 * Composite (componente): contrato comum a serviços individuais e a pacotes
 * de serviços. Quem consome a hierarquia — o projeto, o orquestrador, os
 * validadores — trata um serviço atômico e um pacote com várias camadas de
 * subpacotes exatamente da mesma forma, sem precisar saber qual dos dois tem
 * em mãos.
 */
export interface ServicoProjeto {
  readonly nome: string;

  /** Custo total do serviço; em um pacote, a soma recursiva dos custos dos subserviços. */
  calcularCusto(): number;

  /** Subserviços diretos (lista vazia para um serviço atômico). */
  listarSubservicos(): ReadonlyArray<ServicoProjeto>;

  /** Prazo total em dias, conforme o modo de execução de cada pacote. */
  obterPrazo(): number;

  /** Valida o serviço e, recursivamente, todos os seus subserviços. */
  validar(): ResultadoValidacaoServico;

  /** Todos os serviços atômicos (folhas) da hierarquia, em ordem de declaração. */
  listarAtomicos(): ReadonlyArray<ServicoAtomico>;

  /** Prototype: cópia profunda da hierarquia inteira. */
  clonar(): ServicoProjeto;
}
