import { ProjetoDocumentario } from '../../../src/domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../../src/domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../../src/domain/entities/ProjetoPublicitario';
import { PapelTecnico, TipoCaptacao, TipoProjeto } from '../../../src/domain/entities/types';
import { PacoteServico } from '../../../src/domain/servicos/PacoteServico';
import { ServicoAtomico } from '../../../src/domain/servicos/ServicoAtomico';

describe('Prototype — clonagem de subclasses de Projeto', () => {
  describe('ProjetoDocumentario', () => {
    function criarOriginal(): ProjetoDocumentario {
      return new ProjetoDocumentario({
        titulo: 'Raízes do Sertão',
        genero: 'documentario',
        duracaoEstimadaMinutos: 60,
        orcamentoTotal: 40000,
        dataEntrega: new Date('2027-05-01'),
        tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
        localizacao: { latitude: -8.05, longitude: -34.9, cidade: 'Recife' },
        papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
        produtorId: 'produtor-doc',
        tema: 'Cultura popular nordestina',
        entrevistados: ['Mestre Zé', 'Dona Lia']
      });
    }

    it('clonar() retorna uma instância do mesmo tipo concreto', () => {
      const original = criarOriginal();
      const clone = original.clonar();
      expect(clone).toBeInstanceOf(ProjetoDocumentario);
      expect(clone.tipoProjeto).toBe(TipoProjeto.DOCUMENTARIO);
    });

    it('clonar() copia todos os campos, incluindo os específicos da subclasse', () => {
      const original = criarOriginal();
      const clone = original.clonar();

      expect(clone.titulo).toBe(original.titulo);
      expect(clone.tema).toBe(original.tema);
      expect(clone.entrevistados).toEqual(original.entrevistados);
      expect(clone.papeisRequeridos).toEqual(original.papeisRequeridos);
    });

    it('clonar() produz uma cópia PROFUNDA — mutar o clone não afeta o original', () => {
      const original = criarOriginal();
      const clone = original.clonar();

      clone.entrevistados.push('Novo Entrevistado');
      (clone.servicoPrincipal as PacoteServico).adicionar(
        new ServicoAtomico('Edição', PapelTecnico.EDITOR, 1000, 5)
      );
      clone.localizacao = { latitude: 0, longitude: 0, cidade: 'Outra Cidade' };

      expect(original.entrevistados).toHaveLength(2);
      expect(original.papeisRequeridos).toHaveLength(1);
      expect(original.localizacao.cidade).toBe('Recife');
      expect(clone.localizacao).not.toBe(original.localizacao); // objetos distintos desde a clonagem
    });

    it('clonar() gera uma instância sem id (nova identidade, não a mesma entidade persistida)', () => {
      const original = criarOriginal();
      original.id = 'id-original-ja-persistido';

      const clone = original.clonar();

      expect(clone.id).toBeUndefined();
    });
  });

  describe('ProjetoAnimacao', () => {
    it('clonar() preserva técnica de animação e software, de forma independente', () => {
      const original = new ProjetoAnimacao({
        titulo: 'Mundo de Papel',
        genero: 'infantil',
        duracaoEstimadaMinutos: 25,
        orcamentoTotal: 60000,
        dataEntrega: new Date('2027-08-01'),
        tipoCaptacao: TipoCaptacao.ANIMACAO,
        localizacao: { latitude: -23.5, longitude: -46.6, cidade: 'São Paulo' },
        papeisRequeridos: [{ papel: PapelTecnico.ESPECIALISTA_VFX, pesoImportancia: 1 }],
        produtorId: 'produtor-anim',
        tecnicaAnimacao: 'STOP_MOTION',
        softwarePrincipal: 'Blender'
      });

      const clone = original.clonar();
      clone.tecnicaAnimacao = '3D';

      expect(clone).toBeInstanceOf(ProjetoAnimacao);
      expect(original.tecnicaAnimacao).toBe('STOP_MOTION');
      expect(clone.softwarePrincipal).toBe('Blender');
    });
  });

  describe('ProjetoPublicitario', () => {
    it('clonar() preserva marca anunciante e data de veiculação como uma nova instância de Date', () => {
      const dataVeiculacao = new Date('2027-02-01');
      const original = new ProjetoPublicitario({
        titulo: 'Campanha Verão',
        genero: 'publicidade',
        duracaoEstimadaMinutos: 1,
        orcamentoTotal: 15000,
        dataEntrega: new Date('2027-01-15'),
        tipoCaptacao: TipoCaptacao.FICCAO,
        localizacao: { latitude: -22.9, longitude: -43.2, cidade: 'Rio de Janeiro' },
        papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }],
        produtorId: 'produtor-pub',
        marcaAnunciante: 'Marca XPTO',
        dataVeiculacao
      });

      const clone = original.clonar();

      expect(clone).toBeInstanceOf(ProjetoPublicitario);
      expect(clone.marcaAnunciante).toBe('Marca XPTO');
      expect(clone.dataVeiculacao.getTime()).toBe(dataVeiculacao.getTime());
      expect(clone.dataVeiculacao).not.toBe(dataVeiculacao); // instância de Date distinta
    });
  });

  it('cada subclasse clona-se preservando seu próprio tipo — não há cross-contamination entre famílias', () => {
    const documentario = new ProjetoDocumentario({
      titulo: 'Doc', genero: 'doc', duracaoEstimadaMinutos: 10, orcamentoTotal: 1000,
      dataEntrega: new Date('2027-01-01'), tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' }, papeisRequeridos: [], produtorId: 'p1'
    });
    const animacao = new ProjetoAnimacao({
      titulo: 'Anim', genero: 'anim', duracaoEstimadaMinutos: 10, orcamentoTotal: 1000,
      dataEntrega: new Date('2027-01-01'), tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: { latitude: 0, longitude: 0, cidade: 'X' }, papeisRequeridos: [], produtorId: 'p2'
    });

    expect(documentario.clonar().tipoProjeto).toBe(TipoProjeto.DOCUMENTARIO);
    expect(animacao.clonar().tipoProjeto).toBe(TipoProjeto.ANIMACAO);
  });
});
