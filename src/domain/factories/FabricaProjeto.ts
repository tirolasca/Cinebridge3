import { Projeto } from '../entities/Projeto';
import { DadosCriacaoProjeto } from './DadosCriacaoProjeto';
import { VisitanteProjeto, RecomendacaoStrategy, Observador } from './TiposDeFabrica';

/**
 * Abstract Factory: define a interface para criar a família completa de
 * objetos relacionados a um tipo de projeto — o próprio projeto, seu
 * validador, seu recomendador e seu notificador — garantindo que todos
 * cooperem entre si sem inconsistências.
 *
 * Cada fábrica concreta (FabricaDocumentario, FabricaAnimacao,
 * FabricaPublicitario) implementa esta interface produzindo objetos
 * compatíveis entre si para o seu respectivo tipo de projeto. Isso permite
 * que o OrquestradorEquipe dependa apenas desta abstração — nunca de uma
 * fábrica concreta ou de condicionais baseados no tipo de projeto — e que
 * um novo tipo de projeto seja incorporado à plataforma apenas com a adição
 * de uma nova fábrica concreta, sem qualquer alteração no orquestrador.
 */
export interface FabricaProjeto {
  /**
   * Cria uma nova instância do tipo de projeto desta família a partir dos
   * dados fornecidos. Campos específicos de outros tipos são ignorados.
   */
  criarProjeto(dados: DadosCriacaoProjeto): Projeto;

  /** Cria o validador (Factory Method) específico desta família de objetos. */
  criarValidador(): VisitanteProjeto;

  /** Cria o algoritmo de recomendação (Factory Method) específico desta família de objetos. */
  criarRecomendador(): RecomendacaoStrategy;

  /** Cria o canal de notificação (Factory Method) específico desta família de objetos. */
  criarNotificador(): Observador;
}
