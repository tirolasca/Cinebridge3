import { Profissional } from '../entities/Profissional';
import { Projeto } from '../entities/Projeto';
import { PapelTecnico } from '../entities/types';

/** Resultado de pontuação de um único profissional candidato a um papel. */
export interface CandidatoPontuado {
  readonly profissional: Profissional;
  readonly pontuacao: number; // 0..1
  readonly justificativa: string;
}

/**
 * Strategy: define o contrato comum a todos os algoritmos de recomendação.
 * Cada implementação concreta encapsula uma lógica distinta de ranqueamento,
 * permitindo que o motor troque de algoritmo em tempo de execução sem
 * alterar o código do orquestrador.
 */
export interface EstrategiaRecomendacao {
  /** Identificador único da estratégia, usado para seleção dinâmica. */
  readonly nome: string;

  /**
   * Ranqueia os candidatos disponíveis para um papel específico de um projeto,
   * retornando-os em ordem decrescente de pontuação.
   */
  ranquear(
    projeto: Projeto,
    papel: PapelTecnico,
    candidatos: Profissional[]
  ): CandidatoPontuado[];
}
