import { FabricaProjeto } from '../FabricaProjeto';
import { VisitanteProjeto, RecomendacaoStrategy, Observador } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { DadosCriacaoProjeto, extrairDadosBase } from '../DadosCriacaoProjeto';
import { ProjetoAnimacao } from '../../entities/ProjetoAnimacao';
import { ValidadorAnimacao } from './ValidadorAnimacao';
import { RecomendadorAnimacao } from './RecomendadorAnimacao';
import { NotificadorAnimacao } from './NotificadorAnimacao';

/**
 * Fábrica concreta (Abstract Factory) para a família de objetos do tipo
 * animação.
 */
export class FabricaAnimacao implements FabricaProjeto {
  criarProjeto(dados: DadosCriacaoProjeto): Projeto {
    return new ProjetoAnimacao({
      ...extrairDadosBase(dados),
      tecnicaAnimacao: dados.tecnicaAnimacao,
      softwarePrincipal: dados.softwarePrincipal
    });
  }

  criarValidador(): VisitanteProjeto {
    return new ValidadorAnimacao();
  }

  criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorAnimacao();
  }

  criarNotificador(): Observador {
    return new NotificadorAnimacao();
  }
}
