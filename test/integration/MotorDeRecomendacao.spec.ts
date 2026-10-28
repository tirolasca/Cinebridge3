import { MotorDeRecomendacao } from '../../src/application/services/MotorDeRecomendacao';
import { EstrategiaRecomendacaoFactory } from '../../src/domain/strategies/EstrategiaRecomendacaoFactory';
import { OrquestradorPadrao } from '../../src/application/orchestrator/OrquestradorPadrao';
import { SujeitoDeEventos } from '../../src/domain/events/Observer';
import { NomeEvento, EventoDominio } from '../../src/domain/events/EventosDominio';
import { RepositorioProfissionais } from '../../src/application/services/RepositorioProfissionais';
import { Profissional } from '../../src/domain/entities/Profissional';
import { PapelTecnico } from '../../src/domain/entities/types';
import { criarProfissional, criarCompetencia, criarProjeto } from '../fixtures/builders';

/** Repositório em memória para testes de integração, sem dependência de banco real. */
class RepositorioEmMemoria implements RepositorioProfissionais {
  constructor(
    private readonly dados: Map<PapelTecnico, Profissional[]>,
    private readonly papeisComFalha: Set<PapelTecnico> = new Set()
  ) {}

  async buscarPorPapel(papel: PapelTecnico): Promise<Profissional[]> {
    if (this.papeisComFalha.has(papel)) {
      throw new Error(`Serviço de profissionais indisponível para o papel ${papel}`);
    }
    return this.dados.get(papel) ?? [];
  }
}

describe('MotorDeRecomendacao — integração dos padrões Strategy + Template Method + Observer', () => {
  function montarDadosDeTeste(): Map<PapelTecnico, Profissional[]> {
    return new Map([
      [
        PapelTecnico.DIRETOR,
        [criarProfissional({ nome: 'Diretor A', competencias: [criarCompetencia('direcao_atores', 0.9)] })]
      ],
      [
        PapelTecnico.EDITOR,
        [criarProfissional({ nome: 'Editor A', competencias: [criarCompetencia('edicao_avancada', 0.9)] })]
      ],
      [
        PapelTecnico.SONOPLASTA,
        [criarProfissional({ nome: 'Sonoplasta A', competencias: [criarCompetencia('mixagem_audio', 0.9)] })]
      ]
    ]);
  }

  it('gera uma recomendação completa e publica o evento RECOMENDACAO_GERADA', async () => {
    const repositorio = new RepositorioEmMemoria(montarDadosDeTeste());
    const sujeito = new SujeitoDeEventos();
    const eventos: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventos.push(e); } });

    const motor = new MotorDeRecomendacao(
      new EstrategiaRecomendacaoFactory(),
      new OrquestradorPadrao(),
      repositorio,
      sujeito
    );

    const projeto = criarProjeto({ estrategiaRecomendacao: 'similaridade_cosseno' });
    const recomendacao = await motor.gerarRecomendacao(projeto);

    expect(recomendacao.itens).toHaveLength(3);
    expect(recomendacao.parcial).toBe(false);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe(NomeEvento.RECOMENDACAO_GERADA);
  });

  it('retorna recomendação parcial (fallback) quando o repositório falha para um papel', async () => {
    const repositorio = new RepositorioEmMemoria(
      montarDadosDeTeste(),
      new Set([PapelTecnico.SONOPLASTA])
    );
    const sujeito = new SujeitoDeEventos();

    const motor = new MotorDeRecomendacao(
      new EstrategiaRecomendacaoFactory(),
      new OrquestradorPadrao(),
      repositorio,
      sujeito
    );

    const projeto = criarProjeto({ estrategiaRecomendacao: 'similaridade_cosseno' });
    const recomendacao = await motor.gerarRecomendacao(projeto);

    // Apesar da falha no papel SONOPLASTA, a recomendação é gerada com os demais papéis.
    expect(recomendacao.parcial).toBe(true);
    expect(recomendacao.itens.length).toBe(2);
    expect(recomendacao.itens.some((i) => i.papel === PapelTecnico.SONOPLASTA)).toBe(false);
  });

  it('retorna recomendação totalmente vazia (mas não lança exceção) quando todos os papéis falham', async () => {
    const repositorio = new RepositorioEmMemoria(
      montarDadosDeTeste(),
      new Set([PapelTecnico.DIRETOR, PapelTecnico.EDITOR, PapelTecnico.SONOPLASTA])
    );
    const sujeito = new SujeitoDeEventos();

    const motor = new MotorDeRecomendacao(
      new EstrategiaRecomendacaoFactory(),
      new OrquestradorPadrao(),
      repositorio,
      sujeito
    );

    const projeto = criarProjeto({ estrategiaRecomendacao: 'similaridade_cosseno' });
    const recomendacao = await motor.gerarRecomendacao(projeto);

    expect(recomendacao.parcial).toBe(true);
    expect(recomendacao.itens).toHaveLength(0);
  });

  it('respeita a estratégia configurada no projeto (troca dinâmica via campo estrategiaRecomendacao)', async () => {
    const repositorio = new RepositorioEmMemoria(montarDadosDeTeste());
    const sujeito = new SujeitoDeEventos();

    const motor = new MotorDeRecomendacao(
      new EstrategiaRecomendacaoFactory(),
      new OrquestradorPadrao(),
      repositorio,
      sujeito
    );

    const projetoComFiltragem = criarProjeto({ estrategiaRecomendacao: 'filtragem_colaborativa' });
    const recomendacao = await motor.gerarRecomendacao(projetoComFiltragem);

    expect(recomendacao.estrategiaUtilizada).toBe('filtragem_colaborativa');
  });
});
