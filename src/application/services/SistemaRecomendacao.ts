import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { Recomendacao, ItemRecomendacao } from '../../domain/entities/Recomendacao';
import { PapelTecnico, TipoProjeto } from '../../domain/entities/types';
import { SeletorDeFabricaProjeto } from '../../domain/factories/SeletorDeFabricaProjeto';
import { FabricaProjeto } from '../../domain/factories/FabricaProjeto';
import { FabricaDecorada } from '../../domain/factories/FabricaDecorada';
import { NomeEvento } from '../../domain/events/EventosDominio';
import { SujeitoDeEventos } from '../../domain/events/Observer';
import { Observador, RecomendacaoStrategy } from '../../domain/factories/TiposDeFabrica';
import {
  ConstrutorDePilhaDeRecomendacao,
  PilhaDeDecoradoresInvalidaError
} from '../../domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { OrquestradorEquipe, Equipe } from '../orchestrator/OrquestradorEquipe';
import { OrquestradorPadraoDeFabrica } from '../orchestrator/OrquestradorPadraoDeFabrica';
import { AdaptadorArmazenamento } from '../ports/AdaptadorArmazenamento';
import { AdaptadorPagamento, StatusPagamento } from '../ports/AdaptadorPagamento';
import { AdaptadorProfissional, AvaliacaoDeProfissional } from '../ports/AdaptadorProfissional';
import { AdaptadoresExternos } from '../ports/AdaptadoresExternos';
import { ArgumentoInvalidoError } from '../ports/ErrosDeIntegracao';

/** Membro da equipe sugerida para um papel. */
export interface MembroRecomendado {
  readonly papel: string;
  readonly profissionalId: string;
  readonly nome: string;
}

/** Resultado de uma solicitação de recomendação processada pela família do projeto. */
export interface ResultadoRecomendacao {
  readonly tipoProjeto: TipoProjeto;
  readonly itens: MembroRecomendado[];
  /** true quando algum papel requerido ficou sem profissional sugerido. */
  readonly parcial: boolean;
  /** Custo planejado da hierarquia de serviços do projeto. */
  readonly custoPlanejado: number;
  /** Prazo planejado da hierarquia de serviços, em dias. */
  readonly prazoDias: number;
  /** Pilha de decoradores aplicada ao recomendador nesta solicitação (do mais interno ao mais externo). */
  readonly decoradores: string[];
}

/** Decoradores que podem envolver o recomendador, e a pilha usada quando a solicitação não escolhe uma. */
export interface ConfiguracaoDeDecoradores {
  construtor: ConstrutorDePilhaDeRecomendacao;
  padrao: readonly string[];
}

export interface OpcoesDeRecomendacao {
  /** Pilha de decoradores desta solicitação (preferência do produtor); substitui a pilha padrão. */
  decoradores?: readonly string[];
}

/**
 * Serviço de aplicação que recebe uma solicitação de recomendação, identifica
 * o tipo do projeto e seleciona a fábrica adequada (Factory Method via
 * SeletorDeFabricaProjeto), usando-a para orquestrar todo o ecossistema de
 * objetos necessário — validador, recomendador e notificador — sem conter
 * nenhum condicional de tipo de projeto além da própria seleção da fábrica.
 *
 * Fala com o mundo externo apenas por adaptadores (Adapter): cadastro de
 * profissionais, armazenamento de arquivos e pagamentos. Qualquer provedor
 * pode ser trocado, na construção ou em tempo de execução, sem alterar este
 * código.
 *
 * O recomendador de cada família pode sair envolto numa pilha de decoradores
 * (cache, auditoria, compressão...) definida em tempo de execução. Isso
 * acontece dentro da fábrica (FabricaDecorada): este serviço não conhece
 * nenhum decorador concreto.
 */
export class SistemaRecomendacao {
  private adaptadores: AdaptadoresExternos;
  private estrategiaAtual?: RecomendacaoStrategy;

  constructor(
    private readonly seletorDeFabrica: SeletorDeFabricaProjeto,
    private readonly sujeitoDeEventos: SujeitoDeEventos,
    adaptadores: AdaptadoresExternos,
    private readonly decoradores?: ConfiguracaoDeDecoradores
  ) {
    this.adaptadores = adaptadores;
  }

  // ---------------------------------------------------------------- configuração

  /** Troca, em tempo de execução, os três adaptadores usados para falar com sistemas externos. */
  configurarAdaptadores(
    armazenamento: AdaptadorArmazenamento,
    pagamento: AdaptadorPagamento,
    profissional: AdaptadorProfissional
  ): void {
    this.adaptadores = { armazenamento, pagamento, profissional };
  }

  /** Provedor em uso em cada integração (para diagnóstico). */
  provedoresAtivos(): { armazenamento: string; pagamento: string; profissional: string } {
    return {
      armazenamento: this.adaptadores.armazenamento.provedor,
      pagamento: this.adaptadores.pagamento.provedor,
      profissional: this.adaptadores.profissional.provedor
    };
  }

  /**
   * Define uma estratégia de recomendação que substitui o recomendador padrão
   * de cada família (os decoradores continuam sendo aplicados sobre ela).
   * Sem argumento, volta a usar o recomendador de cada família.
   */
  definirEstrategia(estrategia?: RecomendacaoStrategy): void {
    this.estrategiaAtual = estrategia;
  }

  decoradoresDisponiveis(): string[] {
    return this.decoradores?.construtor.nomesDisponiveis() ?? [];
  }

  pilhaPadrao(): string[] {
    return [...(this.decoradores?.padrao ?? [])];
  }

  // ---------------------------------------------------------------- recomendação

  /**
   * Gera a equipe recomendada para o projeto a partir de candidatos já em
   * mãos, delegando a criação de todo o ecossistema de objetos à fábrica
   * correspondente ao seu tipo. O orquestrador utilizado é o
   * OrquestradorPadraoDeFabrica; outra implementação de OrquestradorEquipe
   * pode ser injetada via o parâmetro opcional `orquestrador` (nesse caso, a
   * fábrica e a pilha de decoradores são as do próprio orquestrador).
   */
  async recomendar(
    projeto: Projeto,
    profissionaisCandidatos: Profissional[],
    orquestrador?: OrquestradorEquipe
  ): Promise<Equipe> {
    const { fabrica } = this.resolverFabrica(projeto);
    return this.comNotificadorDaFamilia(fabrica, () =>
      this.orquestrar(fabrica, projeto, profissionaisCandidatos, orquestrador)
    );
  }

  /**
   * Busca os candidatos no cadastro de profissionais (pelo adaptador em uso,
   * tolerando falhas por papel) e devolve a equipe recomendada.
   */
  async executarRecomendacao(projeto: Projeto, opcoes?: OpcoesDeRecomendacao): Promise<Equipe> {
    const { fabrica } = this.resolverFabrica(projeto, opcoes);
    return this.comNotificadorDaFamilia(fabrica, async () => {
      const candidatos = await this.buscarCandidatosComTolerancia(projeto);
      return this.orquestrar(fabrica, projeto, candidatos);
    });
  }

  /**
   * Fluxo completo de uma solicitação de recomendação: identifica a família
   * do projeto, busca os profissionais candidatos (tolerando falhas do
   * cadastro), orquestra a equipe com os componentes da família e publica o
   * evento de recomendação gerada para os observadores (auditoria, e-mail,
   * mensagens internas e o notificador da própria família).
   *
   * Se a consulta ao cadastro falhar para algum papel, o fluxo segue com os
   * candidatos dos demais papéis e o resultado é marcado como parcial.
   */
  async gerarRecomendacao(projeto: Projeto, opcoes?: OpcoesDeRecomendacao): Promise<ResultadoRecomendacao> {
    const { fabrica, decoradores } = this.resolverFabrica(projeto, opcoes);

    return this.comNotificadorDaFamilia(fabrica, async () => {
      const candidatos = await this.buscarCandidatosComTolerancia(projeto);
      const equipe = this.orquestrar(fabrica, projeto, candidatos);

      const itens: MembroRecomendado[] = Array.from(equipe.entries()).map(([papel, profissional]) => ({
        papel,
        profissionalId: profissional.id,
        nome: profissional.nome
      }));

      const papeisRequeridos = new Set(projeto.papeisRequeridos.map((p) => p.papel));
      const parcial = itens.length < papeisRequeridos.size;

      await this.sujeitoDeEventos.publicar({
        tipo: NomeEvento.RECOMENDACAO_GERADA,
        recomendacao: new Recomendacao({
          projetoId: projeto.id,
          estrategiaUtilizada: `familia_${projeto.tipoProjeto.toLowerCase()}`,
          itens: itens.map(
            (item): ItemRecomendacao => ({
              papel: item.papel as PapelTecnico,
              profissionalId: item.profissionalId,
              // O recomendador da família devolve apenas a escolha, sem a
              // pontuação: NaN sinaliza "não disponível" (serializa como null).
              pontuacao: Number.NaN,
              justificativa: `Selecionado pelo recomendador da família ${projeto.tipoProjeto}`
            })
          ),
          parcial
        })
      });

      return {
        tipoProjeto: projeto.tipoProjeto,
        itens,
        parcial,
        custoPlanejado: projeto.calcularCustoTotal(),
        prazoDias: projeto.obterPrazoTotalDias(),
        decoradores
      };
    });
  }

  // ---------------------------------------------------------------- armazenamento

  /** Anexa um arquivo (roteiro, storyboard, amostra de vídeo...) a um projeto. Devolve o id do arquivo. */
  async anexarArquivo(projetoId: string, nome: string, conteudo: Buffer, tipoConteudo?: string): Promise<string> {
    return this.adaptadores.armazenamento.salvarArquivo(conteudo, {
      nome,
      prefixo: SistemaRecomendacao.prefixoDoProjeto(projetoId),
      tipoConteudo
    });
  }

  async listarArquivos(projetoId: string): Promise<string[]> {
    return this.adaptadores.armazenamento.listarArquivos(SistemaRecomendacao.prefixoDoProjeto(projetoId));
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    return this.adaptadores.armazenamento.recuperarArquivo(id);
  }

  private static prefixoDoProjeto(projetoId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(projetoId)) {
      throw new ArgumentoInvalidoError('Identificador de projeto inválido: use apenas letras, números, "-" e "_".');
    }
    return `projetos/${projetoId}/`;
  }

  // ---------------------------------------------------------------- pagamentos

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    return this.adaptadores.pagamento.efetuarPagamento(valor, origem, destino);
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    return this.adaptadores.pagamento.cancelarPagamento(id);
  }

  async consultarPagamento(id: string): Promise<StatusPagamento> {
    return this.adaptadores.pagamento.verificarPagamento(id);
  }

  // ---------------------------------------------------------------- profissionais

  async registrarAvaliacao(profissionalId: string, avaliacao: AvaliacaoDeProfissional): Promise<void> {
    return this.adaptadores.profissional.registrarAvaliacao(profissionalId, avaliacao);
  }

  // ---------------------------------------------------------------- internos

  /**
   * Escolhe a fábrica a usar: a da família do projeto, envolta (se houver
   * pilha de decoradores ou estratégia definida) numa FabricaDecorada. Os
   * nomes de decoradores são validados antes de qualquer consulta externa.
   */
  private resolverFabrica(projeto: Projeto, opcoes?: OpcoesDeRecomendacao): { fabrica: FabricaProjeto; decoradores: string[] } {
    const original = this.seletorDeFabrica.obterFabrica(projeto.tipoProjeto);
    const nomes = [...(opcoes?.decoradores ?? this.decoradores?.padrao ?? [])];
    const estrategia = this.estrategiaAtual;

    if (nomes.length === 0 && !estrategia) return { fabrica: original, decoradores: [] };

    const construtor = this.decoradores?.construtor;
    if (nomes.length > 0 && !construtor) {
      throw new PilhaDeDecoradoresInvalidaError('Nenhum decorador está configurado neste sistema.');
    }
    construtor?.validar(nomes);

    const decorar = (recomendador: RecomendacaoStrategy) => (construtor ? construtor.construir(recomendador, nomes) : recomendador);
    return { fabrica: new FabricaDecorada(original, decorar, estrategia ? () => estrategia : undefined), decoradores: nomes };
  }

  private orquestrar(
    fabrica: FabricaProjeto,
    projeto: Projeto,
    profissionaisCandidatos: Profissional[],
    orquestrador?: OrquestradorEquipe
  ): Equipe {
    const orquestradorResolvido = orquestrador ?? new OrquestradorPadraoDeFabrica(fabrica);
    return orquestradorResolvido.orquestrar(projeto, profissionaisCandidatos);
  }

  /**
   * Mantém o notificador da família inscrito no sujeito de eventos apenas
   * enquanto a ação executa, para que ele receba os eventos desta solicitação
   * e não permaneça inscrito em chamadas futuras de outros tipos de projeto.
   */
  private async comNotificadorDaFamilia<T>(fabrica: FabricaProjeto, acao: () => Promise<T> | T): Promise<T> {
    const adaptador = this.adaptarObservador(fabrica.criarNotificador());
    this.sujeitoDeEventos.inscrever(adaptador);
    try {
      return await acao();
    } finally {
      this.sujeitoDeEventos.desinscrever(adaptador);
    }
  }

  /**
   * Consulta o cadastro de profissionais papel a papel, isolando falhas: se a
   * consulta de um papel falhar, ele fica sem candidatos em vez de abortar a
   * solicitação.
   */
  private async buscarCandidatosComTolerancia(projeto: Projeto): Promise<Profissional[]> {
    const papeis = Array.from(new Set(projeto.papeisRequeridos.map((p) => p.papel)));
    const buscas = await Promise.allSettled(
      papeis.map((papel) => this.adaptadores.profissional.listarProfissionais({ papel }))
    );

    const candidatosPorId = new Map<string, Profissional>();
    buscas.forEach((busca, indice) => {
      if (busca.status === 'fulfilled') {
        busca.value.forEach((profissional) => candidatosPorId.set(profissional.id, profissional));
      } else {
        // eslint-disable-next-line no-console
        console.error(`[SistemaRecomendacao] Falha ao buscar profissionais para o papel ${papeis[indice]}:`, busca.reason);
      }
    });

    return Array.from(candidatosPorId.values());
  }

  /**
   * Adapta o contrato Observador (da família de objetos da fábrica) ao
   * contrato Observer (do sujeito de eventos já existente), permitindo que
   * o notificador específico de cada tipo de projeto participe do mesmo
   * mecanismo de publicação de eventos usado pelo restante do sistema.
   */
  private adaptarObservador(observador: Observador) {
    return {
      nome: observador.constructor.name,
      notificar: (evento: unknown) => observador.atualizar(evento)
    };
  }
}
