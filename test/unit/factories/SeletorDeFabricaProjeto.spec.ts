import { SeletorDeFabricaProjeto } from '../../../src/domain/factories/SeletorDeFabricaProjeto';
import { FabricaDocumentario } from '../../../src/domain/factories/documentario/FabricaDocumentario';
import { FabricaAnimacao } from '../../../src/domain/factories/animacao/FabricaAnimacao';
import { FabricaPublicitario } from '../../../src/domain/factories/publicitario/FabricaPublicitario';
import { TipoProjeto } from '../../../src/domain/entities/types';

describe('SeletorDeFabricaProjeto (Factory Method)', () => {
  const seletor = new SeletorDeFabricaProjeto();

  it('resolve a fábrica concreta correta para cada tipo de projeto', () => {
    expect(seletor.obterFabrica(TipoProjeto.DOCUMENTARIO)).toBeInstanceOf(FabricaDocumentario);
    expect(seletor.obterFabrica(TipoProjeto.ANIMACAO)).toBeInstanceOf(FabricaAnimacao);
    expect(seletor.obterFabrica(TipoProjeto.PUBLICITARIO)).toBeInstanceOf(FabricaPublicitario);
  });

  it('lista todos os tipos de projeto disponíveis', () => {
    expect(seletor.tiposDisponiveis().sort()).toEqual(
      [TipoProjeto.DOCUMENTARIO, TipoProjeto.ANIMACAO, TipoProjeto.PUBLICITARIO].sort()
    );
  });

  it('lança erro para um tipo de projeto não registrado', () => {
    expect(() => seletor.obterFabrica('REALIDADE_VIRTUAL' as TipoProjeto)).toThrow(/Não há fábrica registrada/);
  });

  it('sempre retorna a mesma instância de fábrica para o mesmo tipo (fábricas são stateless e reaproveitáveis)', () => {
    const primeira = seletor.obterFabrica(TipoProjeto.DOCUMENTARIO);
    const segunda = seletor.obterFabrica(TipoProjeto.DOCUMENTARIO);
    expect(primeira).toBe(segunda);
  });
});
