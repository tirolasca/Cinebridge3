import { criarProjeto } from '../../fixtures/builders';
import { PapelTecnico } from '../../../src/domain/entities/types';

describe('Projeto', () => {
  it('calcula o orçamento máximo proporcional ao peso de importância do papel', () => {
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.6 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 0.4 }
      ]
    });

    expect(projeto.orcamentoMaximoParaPapel(PapelTecnico.DIRETOR)).toBeCloseTo(6000, 5);
    expect(projeto.orcamentoMaximoParaPapel(PapelTecnico.EDITOR)).toBeCloseTo(4000, 5);
  });

  it('retorna 0 para um papel não requerido pelo projeto', () => {
    const projeto = criarProjeto({
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });
    expect(projeto.orcamentoMaximoParaPapel(PapelTecnico.SONOPLASTA)).toBe(0);
  });
});
