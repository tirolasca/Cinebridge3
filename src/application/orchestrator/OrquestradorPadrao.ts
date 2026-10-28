import { OrquestradorComposicaoEquipe } from './OrquestradorComposicaoEquipe';
import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { ItemRecomendacao } from '../../domain/entities/Recomendacao';
import { PapelTecnico } from '../../domain/entities/types';

/**
 * Implementação concreta (Template Method) do orquestrador para o fluxo
 * padrão de negócio da cinebridge:
 * - valida que o orçamento total do projeto é positivo e o prazo é futuro;
 * - normaliza removendo profissionais indisponíveis no período do projeto;
 * - pós-processa arredondando pontuações para 2 casas decimais.
 */
export class OrquestradorPadrao extends OrquestradorComposicaoEquipe {
  protected validarRestricoesOrcamentarias(projeto: Projeto): void {
    if (projeto.orcamentoTotal <= 0) {
      throw new Error('Orçamento total do projeto deve ser maior que zero.');
    }
    if (projeto.dataEntrega.getTime() <= Date.now()) {
      throw new Error('Data de entrega do projeto deve estar no futuro.');
    }
    if (projeto.papeisRequeridos.length === 0) {
      throw new Error('Projeto deve ter ao menos um papel técnico obrigatório definido.');
    }
  }

  protected normalizarDadosDeEntrada(
    profissionaisPorPapel: Map<PapelTecnico, Profissional[]>
  ): Map<PapelTecnico, Profissional[]> {
    const normalizado = new Map<PapelTecnico, Profissional[]>();

    for (const [papel, profissionais] of profissionaisPorPapel.entries()) {
      // Remove duplicados por id, preservando a primeira ocorrência.
      const vistos = new Set<string>();
      const semDuplicatas = profissionais.filter((p) => {
        if (vistos.has(p.id)) return false;
        vistos.add(p.id);
        return true;
      });
      normalizado.set(papel, semDuplicatas);
    }

    return normalizado;
  }

  protected posProcessarRecomendacoes(itens: ItemRecomendacao[], _projeto: Projeto): ItemRecomendacao[] {
    return itens.map((item) => ({
      ...item,
      pontuacao: Math.round(item.pontuacao * 100) / 100
    }));
  }
}
