import { criarProfissional, criarAvaliacao } from '../../fixtures/builders';

describe('Profissional', () => {
  it('calcula a nota média corretamente', () => {
    const profissional = criarProfissional({
      avaliacoes: [criarAvaliacao(4), criarAvaliacao(5), criarAvaliacao(3)]
    });
    expect(profissional.notaMedia()).toBeCloseTo(4, 5);
  });

  it('retorna nota média 0 quando não há avaliações', () => {
    const profissional = criarProfissional({ avaliacoes: [] });
    expect(profissional.notaMedia()).toBe(0);
  });

  it('identifica disponibilidade dentro de uma janela cadastrada', () => {
    const profissional = criarProfissional({
      disponibilidade: [{ inicio: new Date('2026-03-01'), fim: new Date('2026-06-01') }]
    });
    expect(profissional.estaDisponivelEm(new Date('2026-04-01'), new Date('2026-05-01'))).toBe(true);
  });

  it('identifica indisponibilidade fora de qualquer janela cadastrada', () => {
    const profissional = criarProfissional({
      disponibilidade: [{ inicio: new Date('2026-03-01'), fim: new Date('2026-06-01') }]
    });
    expect(profissional.estaDisponivelEm(new Date('2027-01-01'), new Date('2027-02-01'))).toBe(false);
  });

  it('verifica se cabe no orçamento máximo informado', () => {
    const profissional = criarProfissional({ faixaDePreco: { minimo: 2000, maximo: 3000 } });
    expect(profissional.cabeNoOrcamento(2500)).toBe(true);
    expect(profissional.cabeNoOrcamento(1000)).toBe(false);
  });
});
