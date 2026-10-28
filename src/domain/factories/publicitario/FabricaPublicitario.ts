import { FabricaProjeto } from '../FabricaProjeto';
import { VisitanteProjeto, RecomendacaoStrategy, Observador } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { DadosCriacaoProjeto, extrairDadosBase } from '../DadosCriacaoProjeto';
import { ProjetoPublicitario } from '../../entities/ProjetoPublicitario';
import { ValidadorPublicitario } from './ValidadorPublicitario';
import { RecomendadorPublicitario } from './RecomendadorPublicitario';
import { NotificadorPublicitario } from './NotificadorPublicitario';

/**
 * Fábrica concreta (Abstract Factory) para a família de objetos do tipo
 * publicitário.
 */
export class FabricaPublicitario implements FabricaProjeto {
  criarProjeto(dados: DadosCriacaoProjeto): Projeto {
    return new ProjetoPublicitario({
      ...extrairDadosBase(dados),
      marcaAnunciante: dados.marcaAnunciante,
      dataVeiculacao: dados.dataVeiculacao
    });
  }

  criarValidador(): VisitanteProjeto {
    return new ValidadorPublicitario();
  }

  criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorPublicitario();
  }

  criarNotificador(): Observador {
    return new NotificadorPublicitario();
  }
}
