import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';
import { PapelTecnico } from '../entities/types';

/**
 * Nó da árvore de dados do projeto: agrupa o Projeto com a equipe montada
 * (mapa de papel -> profissional escolhido). É esta estrutura que os
 * Visitors percorrem, sem que Projeto ou Profissional precisem conhecer
 * as operações de validação, compatibilidade ou relatório.
 */
export class ArvoreDeComposicao {
  constructor(
    public readonly projeto: Projeto,
    public readonly equipe: ReadonlyMap<PapelTecnico, Profissional>
  ) {}

  aceitar<T>(visitante: VisitanteDeComposicao<T>): T {
    return visitante.visitar(this);
  }
}

/**
 * Visitor: contrato genérico para operações transversais sobre a
 * ArvoreDeComposicao. Cada implementação concreta define uma operação
 * distinta (validação, métrica de compatibilidade, relatório) sem alterar
 * as classes de domínio Projeto ou Profissional.
 */
export interface VisitanteDeComposicao<T> {
  visitar(arvore: ArvoreDeComposicao): T;
}
