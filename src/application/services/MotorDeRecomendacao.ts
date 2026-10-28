import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { Recomendacao } from '../../domain/entities/Recomendacao';
import { PapelTecnico } from '../../domain/entities/types';
import { EstrategiaRecomendacaoFactory } from '../../domain/strategies/EstrategiaRecomendacaoFactory';
import { OrquestradorComposicaoEquipe } from '../orchestrator/OrquestradorComposicaoEquipe';
import { SujeitoDeEventos } from '../../domain/events/Observer';
import { NomeEvento } from '../../domain/events/EventosDominio';
import { RepositorioProfissionais } from './RepositorioProfissionais';

/**
 * Erro específico para indicar que a recomendação foi gerada em modo de
 * contingência (fallback), atendendo ao requisito de tolerância a falhas
 * quando o repositório de profissionais estiver indisponível.
 */
export class FalhaRepositorioProfissionais extends Error {}

/**
 * Serviço de aplicação: ponto de entrada do caso de uso "gerar recomendação
 * de equipe para um projeto". Integra os quatro padrões:
 * - Strategy: seleciona dinamicamente o algoritmo de recomendação;
 * - Template Method: delega ao orquestrador o fluxo fixo de composição;
 * - Observer: publica o evento RECOMENDACAO_GERADA ao final do processo;
 * - Visitor: não é usado diretamente aqui, mas opera sobre o resultado
 *   (ver ServicoDeComposicaoFinal).
 */
export class MotorDeRecomendacao {
  constructor(
    private readonly estrategiaFactory: EstrategiaRecomendacaoFactory,
    private readonly orquestrador: OrquestradorComposicaoEquipe,
    private readonly repositorioProfissionais: RepositorioProfissionais,
    private readonly sujeitoDeEventos: SujeitoDeEventos
  ) {}

  /**
   * Gera uma recomendação de equipe completa para o projeto informado.
   * Em caso de falha na consulta ao repositório de profissionais para um
   * ou mais papéis, retorna uma recomendação parcial (fallback) em vez de
   * propagar a falha, conforme requisito não funcional de tolerância a falhas.
   */
  async gerarRecomendacao(projeto: Projeto): Promise<Recomendacao> {
    const estrategia = this.estrategiaFactory.obter(projeto.estrategiaRecomendacao);
    const profissionaisPorPapel = await this.buscarProfissionaisComTolerancia(projeto.papeisRequeridos.map((p) => p.papel));

    const recomendacao = await this.orquestrador.compor(projeto, estrategia, profissionaisPorPapel);

    await this.sujeitoDeEventos.publicar({
      tipo: NomeEvento.RECOMENDACAO_GERADA,
      recomendacao
    });

    return recomendacao;
  }

  /**
   * Consulta o repositório de profissionais papel a papel, isolando falhas:
   * se a consulta para um papel específico falhar (ex.: serviço externo
   * indisponível), o papel é registrado com lista vazia em vez de abortar
   * toda a operação, permitindo recomendações parciais.
   */
  private async buscarProfissionaisComTolerancia(
    papeis: PapelTecnico[]
  ): Promise<Map<PapelTecnico, Profissional[]>> {
    const resultado = new Map<PapelTecnico, Profissional[]>();

    const buscas = await Promise.allSettled(
      papeis.map(async (papel) => ({
        papel,
        profissionais: await this.repositorioProfissionais.buscarPorPapel(papel)
      }))
    );

    buscas.forEach((busca, indice) => {
      const papel = papeis[indice];
      if (busca.status === 'fulfilled') {
        resultado.set(papel, busca.value.profissionais);
      } else {
        // eslint-disable-next-line no-console
        console.error(`[MotorDeRecomendacao] Falha ao buscar profissionais para o papel ${papel}:`, busca.reason);
        resultado.set(papel, []);
      }
    });

    return resultado;
  }
}
