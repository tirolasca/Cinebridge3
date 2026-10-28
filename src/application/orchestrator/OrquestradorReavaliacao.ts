import { OrquestradorComposicaoEquipe } from './OrquestradorComposicaoEquipe';
import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { ItemRecomendacao } from '../../domain/entities/Recomendacao';
import { PapelTecnico } from '../../domain/entities/types';

/**
 * Segunda implementação concreta (Template Method) do orquestrador, voltada
 * a reprocessamentos administrativos (ex.: reavaliação solicitada pelo
 * produtor após mudança de orçamento). Valida com regras mais permissivas
 * (não exige prazo futuro, pois o projeto já está em andamento) e não filtra
 * duplicatas, mas mantém exatamente o mesmo fluxo de etapas do
 * OrquestradorPadrao — demonstrando a invariância garantida pelo método
 * template da classe base.
 */
export class OrquestradorReavaliacao extends OrquestradorComposicaoEquipe {
  protected validarRestricoesOrcamentarias(projeto: Projeto): void {
    if (projeto.orcamentoTotal <= 0) {
      throw new Error('Orçamento total do projeto deve ser maior que zero.');
    }
    if (projeto.papeisRequeridos.length === 0) {
      throw new Error('Projeto deve ter ao menos um papel técnico obrigatório definido.');
    }
    // Sem validação de prazo futuro: reavaliações podem ocorrer próximo à entrega.
  }

  protected normalizarDadosDeEntrada(
    profissionaisPorPapel: Map<PapelTecnico, Profissional[]>
  ): Map<PapelTecnico, Profissional[]> {
    // Reavaliação não remove duplicatas: mantém o conjunto de candidatos tal como fornecido.
    return profissionaisPorPapel;
  }

  protected posProcessarRecomendacoes(itens: ItemRecomendacao[], _projeto: Projeto): ItemRecomendacao[] {
    // Pontuação mantida com precisão total, sem arredondamento, para permitir
    // comparação fina entre rodadas de reavaliação sucessivas.
    return itens;
  }
}
