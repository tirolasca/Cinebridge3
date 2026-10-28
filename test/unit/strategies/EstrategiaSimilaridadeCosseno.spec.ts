import { EstrategiaSimilaridadeCosseno } from '../../../src/domain/strategies/EstrategiaSimilaridadeCosseno';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarCompetencia, criarProjeto } from '../../fixtures/builders';

describe('EstrategiaSimilaridadeCosseno', () => {
  const estrategia = new EstrategiaSimilaridadeCosseno();

  it('possui o nome identificador correto', () => {
    expect(estrategia.nome).toBe('similaridade_cosseno');
  });

  it('ranqueia mais alto o profissional cujo vetor de competências é mais próximo do ideal do papel', () => {
    const projeto = criarProjeto();

    const editorForte = criarProfissional({
      nome: 'Editor Forte',
      competencias: [
        criarCompetencia('edicao_avancada', 1.0),
        criarCompetencia('ritmo_narrativo', 1.0),
        criarCompetencia('color_grading', 1.0)
      ]
    });

    const editorFraco = criarProfissional({
      nome: 'Editor Fraco',
      competencias: [criarCompetencia('edicao_avancada', 0.2)]
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.EDITOR, [editorFraco, editorForte]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].profissional.nome).toBe('Editor Forte');
    expect(resultado[0].pontuacao).toBeGreaterThan(resultado[1].pontuacao);
  });

  it('retorna pontuação 0 para profissional sem nenhuma competência cadastrada', () => {
    const projeto = criarProjeto();
    const semCompetencias = criarProfissional({ competencias: [] });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [semCompetencias]);

    expect(resultado[0].pontuacao).toBe(0);
  });

  it('retorna lista vazia quando não há candidatos', () => {
    const projeto = criarProjeto();
    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, []);
    expect(resultado).toEqual([]);
  });

  it('inclui uma justificativa textual para cada candidato pontuado', () => {
    const projeto = criarProjeto();
    const profissional = criarProfissional({
      competencias: [criarCompetencia('direcao_atores', 0.8)]
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [profissional]);

    expect(resultado[0].justificativa).toContain('Similaridade');
  });
});
