import { EstrategiaFiltragemColaborativa } from '../../../src/domain/strategies/EstrategiaFiltragemColaborativa';
import { PapelTecnico } from '../../../src/domain/entities/types';
import { criarProfissional, criarAvaliacao, criarProjeto } from '../../fixtures/builders';

describe('EstrategiaFiltragemColaborativa', () => {
  const estrategia = new EstrategiaFiltragemColaborativa();

  it('possui o nome identificador correto', () => {
    expect(estrategia.nome).toBe('filtragem_colaborativa');
  });

  it('ranqueia mais alto o profissional com melhor nota média e mais experiência', () => {
    const projeto = criarProjeto();

    const experiente = criarProfissional({
      nome: 'Experiente',
      especialidadePrincipal: PapelTecnico.DIRETOR,
      avaliacoes: [criarAvaliacao(5), criarAvaliacao(4.5), criarAvaliacao(5)],
      historicoProjetos: ['p1', 'p2', 'p3', 'p4', 'p5']
    });

    const iniciante = criarProfissional({
      nome: 'Iniciante',
      especialidadePrincipal: PapelTecnico.DIRETOR,
      avaliacoes: [criarAvaliacao(3)],
      historicoProjetos: ['p1']
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [iniciante, experiente]);

    expect(resultado[0].profissional.nome).toBe('Experiente');
    expect(resultado[0].pontuacao).toBeGreaterThan(resultado[1].pontuacao);
  });

  it('exclui profissionais sem avaliações e sem a especialidade principal do papel', () => {
    const projeto = criarProjeto();

    const irrelevante = criarProfissional({
      especialidadePrincipal: PapelTecnico.SONOPLASTA,
      avaliacoes: []
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.DIRETOR, [irrelevante]);

    expect(resultado).toHaveLength(0);
  });

  it('calcula justificativa com a nota média e volume de projetos anteriores', () => {
    const projeto = criarProjeto();
    const profissional = criarProfissional({
      especialidadePrincipal: PapelTecnico.EDITOR,
      avaliacoes: [criarAvaliacao(4)],
      historicoProjetos: ['p1', 'p2']
    });

    const resultado = estrategia.ranquear(projeto, PapelTecnico.EDITOR, [profissional]);

    expect(resultado[0].justificativa).toContain('4.0/5');
    expect(resultado[0].justificativa).toContain('2 projeto');
  });
});
