import { OrquestradorEquipe, Equipe } from './OrquestradorEquipe';
import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';

/**
 * Implementação concreta padrão do OrquestradorEquipe: usa o validador
 * obtido da fábrica para checar o projeto e filtrar profissionais
 * inadequados, e não aplica pós-processamento adicional sobre a equipe.
 *
 * Esta classe NUNCA verifica o tipo concreto do projeto nem da fábrica —
 * toda a variação de comportamento por tipo de projeto já está encapsulada
 * dentro do validador e do recomendador que a fábrica injetada fornece.
 */
export class OrquestradorPadraoDeFabrica extends OrquestradorEquipe {
  protected validarRestricoes(projeto: Projeto): boolean {
    // Restrições comuns a todos os tipos de projeto (não dependem da família).
    if (projeto.orcamentoTotal <= 0) {
      throw new Error('Orçamento total do projeto deve ser maior que zero.');
    }
    if (projeto.dataEntrega.getTime() <= Date.now()) {
      throw new Error('Data de entrega do projeto deve estar no futuro.');
    }
    if (projeto.papeisRequeridos.length === 0) {
      throw new Error('Projeto deve ter ao menos um papel técnico obrigatório definido.');
    }

    // Estrutura de serviços (Composite): validação recursiva de papéis, custos
    // e prazos, e coerência com o orçamento e com a data de entrega.
    const estrutura = projeto.validarEstrutura();
    if (!estrutura.valido) {
      throw new Error(`Estrutura de serviços inválida: ${estrutura.erros.join(' ')}`);
    }

    // Restrições específicas do tipo, delegadas ao validador da família.
    const validador = this.fabrica.criarValidador();
    return validador.visitarProjeto(projeto);
  }

  protected normalizarDados(_projeto: Projeto, profissionais: Profissional[]): Profissional[] {
    const validador = this.fabrica.criarValidador();
    return profissionais.filter((profissional) => validador.visitarProfissional(profissional));
  }

  protected posProcessar(equipe: Equipe, _projeto: Projeto): Equipe {
    return equipe;
  }
}
