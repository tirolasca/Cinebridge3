import { ValidadorDocumentario } from '../../../src/domain/factories/documentario/ValidadorDocumentario';
import { ValidadorAnimacao } from '../../../src/domain/factories/animacao/ValidadorAnimacao';
import { ValidadorPublicitario } from '../../../src/domain/factories/publicitario/ValidadorPublicitario';
import { ProjetoDocumentario } from '../../../src/domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../../src/domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../../src/domain/entities/ProjetoPublicitario';
import { criarProfissional, criarCompetencia } from '../../fixtures/builders';
import { PapelTecnico, TipoCaptacao } from '../../../src/domain/entities/types';

const dadosBase = {
  titulo: 'Projeto', genero: 'g', duracaoEstimadaMinutos: 10, orcamentoTotal: 1000,
  dataEntrega: new Date('2027-01-01'), tipoCaptacao: TipoCaptacao.FICCAO,
  localizacao: { latitude: 0, longitude: 0, cidade: 'X' }, papeisRequeridos: [], produtorId: 'p1'
};

describe('ValidadorDocumentario', () => {
  const validador = new ValidadorDocumentario();

  it('aceita um projeto com tema e entrevistados definidos', () => {
    const projeto = new ProjetoDocumentario({ ...dadosBase, tema: 'Cultura', entrevistados: ['A'] });
    expect(validador.visitarProjeto(projeto)).toBe(true);
  });

  it('rejeita um projeto sem tema', () => {
    const projeto = new ProjetoDocumentario({ ...dadosBase, tema: '', entrevistados: ['A'] });
    expect(validador.visitarProjeto(projeto)).toBe(false);
  });

  it('rejeita um projeto sem entrevistados', () => {
    const projeto = new ProjetoDocumentario({ ...dadosBase, tema: 'Cultura', entrevistados: [] });
    expect(validador.visitarProjeto(projeto)).toBe(false);
  });

  it('exige competência registrada para o papel de roteirista', () => {
    const roteiristaSemCompetencia = criarProfissional({
      especialidadePrincipal: PapelTecnico.ROTEIRISTA,
      competencias: []
    });
    const roteiristaComCompetencia = criarProfissional({
      especialidadePrincipal: PapelTecnico.ROTEIRISTA,
      competencias: [criarCompetencia('estrutura_narrativa', 0.8)]
    });

    expect(validador.visitarProfissional(roteiristaSemCompetencia)).toBe(false);
    expect(validador.visitarProfissional(roteiristaComCompetencia)).toBe(true);
  });
});

describe('ValidadorAnimacao', () => {
  const validador = new ValidadorAnimacao();

  it('aceita um projeto com técnica e software definidos', () => {
    const projeto = new ProjetoAnimacao({ ...dadosBase, tecnicaAnimacao: '3D', softwarePrincipal: 'Blender' });
    expect(validador.visitarProjeto(projeto)).toBe(true);
  });

  it('rejeita um projeto sem técnica de animação', () => {
    const projeto = new ProjetoAnimacao({ ...dadosBase, tecnicaAnimacao: '', softwarePrincipal: 'Blender' });
    expect(validador.visitarProjeto(projeto)).toBe(false);
  });

  it('exige competência em modelagem 3D ou motion graphics para especialista em VFX', () => {
    const semCompetenciaAdequada = criarProfissional({
      especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
      competencias: [criarCompetencia('composicao_digital', 0.9)]
    });
    const comCompetenciaAdequada = criarProfissional({
      especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
      competencias: [criarCompetencia('modelagem_3d', 0.9)]
    });

    expect(validador.visitarProfissional(semCompetenciaAdequada)).toBe(false);
    expect(validador.visitarProfissional(comCompetenciaAdequada)).toBe(true);
  });
});

describe('ValidadorPublicitario', () => {
  const validador = new ValidadorPublicitario();

  it('aceita um projeto com marca e data de veiculação posterior à entrega', () => {
    const projeto = new ProjetoPublicitario({
      ...dadosBase,
      dataEntrega: new Date('2027-01-01'),
      marcaAnunciante: 'Marca X',
      dataVeiculacao: new Date('2027-02-01')
    });
    expect(validador.visitarProjeto(projeto)).toBe(true);
  });

  it('rejeita um projeto cuja data de veiculação é anterior à data de entrega', () => {
    const projeto = new ProjetoPublicitario({
      ...dadosBase,
      dataEntrega: new Date('2027-02-01'),
      marcaAnunciante: 'Marca X',
      dataVeiculacao: new Date('2027-01-01')
    });
    expect(validador.visitarProjeto(projeto)).toBe(false);
  });

  it('rejeita um projeto sem marca anunciante', () => {
    const projeto = new ProjetoPublicitario({
      ...dadosBase,
      marcaAnunciante: '',
      dataVeiculacao: new Date('2027-02-01')
    });
    expect(validador.visitarProjeto(projeto)).toBe(false);
  });
});
