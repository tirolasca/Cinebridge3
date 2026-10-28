import { EstrategiaRecomendacaoFactory } from '../../../src/domain/strategies/EstrategiaRecomendacaoFactory';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarCompetencia, criarAvaliacao, criarProjeto } from '../../fixtures/builders';

describe('EstrategiaRecomendacaoFactory — troca dinâmica de estratégia', () => {
  const factory = new EstrategiaRecomendacaoFactory();

  it('lista as três estratégias definidas no enunciado', () => {
    expect(factory.listarNomesDisponiveis().sort()).toEqual(
      ['filtragem_colaborativa', 'orcamento_reduzido', 'similaridade_cosseno'].sort()
    );
  });

  it('lança erro para uma estratégia desconhecida', () => {
    expect(() => factory.obter('estrategia_inexistente')).toThrow(/desconhecida/);
  });

  it('a mesma lista de candidatos produz ranqueamentos diferentes conforme a estratégia escolhida', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 5000,
      papeisRequeridos: [{ papel: PapelTecnico.EDITOR, pesoImportancia: 1 }]
    });

    // Alta competência técnica, caro, sem histórico de avaliações.
    const especialistaCaro = criarProfissional({
      nome: 'Especialista Caro',
      faixaDePreco: { minimo: 4500, maximo: 5000 },
      competencias: [
        criarCompetencia('edicao_avancada', 1.0),
        criarCompetencia('ritmo_narrativo', 1.0),
        criarCompetencia('color_grading', 1.0)
      ],
      avaliacoes: []
    });

    // Baixa competência técnica declarada, barato, com boas avaliações antigas.
    const genericoBarato = criarProfissional({
      nome: 'Genérico Barato',
      faixaDePreco: { minimo: 500, maximo: 800 },
      competencias: [criarCompetencia('edicao_avancada', 0.1)],
      avaliacoes: [criarAvaliacao(4.8), criarAvaliacao(5)]
    });

    const candidatos = [especialistaCaro, genericoBarato];

    const porSimilaridade = factory
      .obter('similaridade_cosseno')
      .ranquear(projeto, PapelTecnico.EDITOR, candidatos);
    const porOrcamento = factory
      .obter('orcamento_reduzido')
      .ranquear(projeto, PapelTecnico.EDITOR, candidatos);

    // A estratégia de similaridade favorece o especialista tecnicamente mais forte...
    expect(porSimilaridade[0].profissional.nome).toBe('Especialista Caro');
    // ...enquanto a estratégia de orçamento reduzido favorece o mais barato.
    expect(porOrcamento[0].profissional.nome).toBe('Genérico Barato');

    // Prova de que o resultado do MESMO conjunto de candidatos muda com a estratégia.
    expect(porSimilaridade[0].profissional.nome).not.toBe(porOrcamento[0].profissional.nome);
  });
});
