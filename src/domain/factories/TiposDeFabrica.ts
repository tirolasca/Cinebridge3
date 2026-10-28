import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';

/**
 * Validador específico de um tipo de projeto (parte da família de objetos
 * produzida pela Abstract Factory). Nomeado conforme o diagrama de classes:
 * percorre o projeto e cada profissional candidato aplicando regras de
 * consistência próprias do gênero (ex.: um documentário exige tema e
 * entrevistados definidos; um publicitário exige prazo de veiculação
 * compatível com a data de entrega).
 *
 * Distinto do VisitanteDeComposicao (domain/visitors): aquele opera sobre a
 * ArvoreDeComposicao (projeto + equipe já montada) de forma agnóstica ao
 * tipo de projeto; este opera sobre o projeto e um profissional individual,
 * com regras que variam conforme a família de objetos em uso.
 */
export interface VisitanteProjeto {
  visitarProjeto(projeto: Projeto): boolean;
  visitarProfissional(profissional: Profissional): boolean;
}

/**
 * Algoritmo de recomendação no nível da família de objetos da fábrica
 * (distinto, mas compatível em espírito, da EstrategiaRecomendacao já
 * existente em domain/strategies, que opera papel a papel). Nomeado
 * conforme o diagrama: dado um projeto e a lista de profissionais
 * candidatos, retorna o mapeamento completo papel -> profissional sugerido.
 */
export interface RecomendacaoStrategy {
  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional>;
}

/**
 * Canal de notificação específico de uma família de objetos (parte da
 * Abstract Factory). Cada fábrica concreta pode produzir um notificador
 * com formato/conteúdo ajustado ao tipo de projeto (ex.: um notificador de
 * documentário pode incluir o tema na mensagem).
 */
export interface Observador {
  atualizar(evento: unknown): void;
}
