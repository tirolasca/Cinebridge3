import { ServicoAtomico } from '../../../src/domain/servicos/ServicoAtomico';
import { PacoteServico } from '../../../src/domain/servicos/PacoteServico';
import { ModoExecucao, ServicoProjeto } from '../../../src/domain/servicos/ServicoProjeto';
import {
  ServicoInvalidoError,
  desserializarServico,
  papeisRequeridosDe,
  serializarServico,
  servicoDePapeis
} from '../../../src/domain/servicos/ServicoJson';
import { PapelTecnico } from '../../../src/domain/entities/types';

const edicao = () => new ServicoAtomico('Edição', PapelTecnico.EDITOR, 4000, 10);
const coloracao = () => new ServicoAtomico('Coloração', PapelTecnico.EDITOR, 2000, 4);
const mixagem = () => new ServicoAtomico('Mixagem', PapelTecnico.SONOPLASTA, 3000, 6);
const vfx = () => new ServicoAtomico('Efeitos visuais', PapelTecnico.ESPECIALISTA_VFX, 6000, 12);

describe('Composite — ServicoAtomico', () => {
  it('expõe custo, prazo e papel, e não tem subserviços', () => {
    const servico = edicao();

    expect(servico.calcularCusto()).toBe(4000);
    expect(servico.obterPrazo()).toBe(10);
    expect(servico.papel).toBe(PapelTecnico.EDITOR);
    expect(servico.listarSubservicos()).toEqual([]);
    expect(servico.listarAtomicos()).toEqual([servico]);
  });

  it('valida um serviço correto', () => {
    expect(edicao().validar()).toEqual({ valido: true, erros: [] });
  });

  it.each([
    ['sem nome', new ServicoAtomico('', PapelTecnico.EDITOR, 100, 1), /sem nome/],
    ['papel inexistente', new ServicoAtomico('X', 'COZINHEIRO' as PapelTecnico, 100, 1), /papel técnico inválido/],
    ['custo negativo', new ServicoAtomico('X', PapelTecnico.EDITOR, -1, 1), /custo/],
    ['custo não numérico', new ServicoAtomico('X', PapelTecnico.EDITOR, Number.NaN, 1), /custo/],
    ['prazo zero', new ServicoAtomico('X', PapelTecnico.EDITOR, 100, 0), /prazo/],
    ['prazo fracionado', new ServicoAtomico('X', PapelTecnico.EDITOR, 100, 1.5), /prazo/]
  ])('rejeita serviço %s', (_descricao, servico, mensagem) => {
    const resultado = servico.validar();
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.join(' ')).toMatch(mensagem);
  });

  it('clonar() devolve uma cópia independente', () => {
    const original = edicao();
    const copia = original.clonar();

    expect(copia).not.toBe(original);
    expect(copia).toEqual(original);
  });
});

describe('Composite — PacoteServico', () => {
  it('trata um pacote exatamente como um serviço atômico (mesma interface)', () => {
    const tratar = (servico: ServicoProjeto) => ({
      custo: servico.calcularCusto(),
      prazo: servico.obterPrazo(),
      valido: servico.validar().valido
    });

    expect(tratar(edicao())).toEqual({ custo: 4000, prazo: 10, valido: true });
    expect(tratar(new PacoteServico('Pós', ModoExecucao.SEQUENCIAL, [edicao(), mixagem()]))).toEqual({
      custo: 7000,
      prazo: 16,
      valido: true
    });
  });

  it('soma custos e prazos de um pacote com um nível', () => {
    const pacote = new PacoteServico('Pós-produção', ModoExecucao.SEQUENCIAL, [edicao(), coloracao(), mixagem()]);

    expect(pacote.calcularCusto()).toBe(9000);
    expect(pacote.obterPrazo()).toBe(20);
    expect(pacote.listarSubservicos()).toHaveLength(3);
  });

  it('em modo PARALELO o prazo é o do subserviço mais demorado, mas o custo continua somado', () => {
    const pacote = new PacoteServico('Pós', ModoExecucao.PARALELO, [edicao(), coloracao(), mixagem()]);

    expect(pacote.obterPrazo()).toBe(10);
    expect(pacote.calcularCusto()).toBe(9000);
  });

  it('propaga custo e prazo por uma hierarquia de várias profundidades', () => {
    // Projeto (SEQ)
    //  ├─ Pré-produção (PAR): Roteiro 8d/1500 ; Locações 3d/500
    //  └─ Pós-produção (SEQ)
    //      ├─ Imagem (PAR): Edição 10d/4000 ; Coloração 4d/2000
    //      └─ Som: Mixagem 6d/3000
    const roteiro = new ServicoAtomico('Roteiro', PapelTecnico.ROTEIRISTA, 1500, 8);
    const locacoes = new ServicoAtomico('Locações', PapelTecnico.DIRETOR, 500, 3);
    const preProducao = new PacoteServico('Pré-produção', ModoExecucao.PARALELO, [roteiro, locacoes]);
    const imagem = new PacoteServico('Imagem', ModoExecucao.PARALELO, [edicao(), coloracao()]);
    const posProducao = new PacoteServico('Pós-produção', ModoExecucao.SEQUENCIAL, [imagem, mixagem()]);
    const projeto = new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [preProducao, posProducao]);

    expect(projeto.calcularCusto()).toBe(1500 + 500 + 4000 + 2000 + 3000);
    // 8 (pré, paralelo) + [10 (imagem, paralelo) + 6 (som)] = 24
    expect(projeto.obterPrazo()).toBe(24);
    expect(projeto.listarAtomicos().map((s) => s.nome)).toEqual([
      'Roteiro', 'Locações', 'Edição', 'Coloração', 'Mixagem'
    ]);
    expect(posProducao.calcularCusto()).toBe(9000); // cada nível tem o seu próprio total
  });

  it('um pacote vazio tem custo e prazo zero', () => {
    const vazio = new PacoteServico('Vazio');
    expect(vazio.calcularCusto()).toBe(0);
    expect(vazio.obterPrazo()).toBe(0);
  });

  it('permite adicionar e remover subserviços depois de criado', () => {
    const pacote = new PacoteServico('Pacote');
    const servico = edicao();

    pacote.adicionar(servico).adicionar(mixagem());
    expect(pacote.listarSubservicos()).toHaveLength(2);

    expect(pacote.remover(servico)).toBe(true);
    expect(pacote.remover(servico)).toBe(false);
    expect(pacote.calcularCusto()).toBe(3000);
  });

  it('listarSubservicos() devolve uma cópia: alterá-la não altera o pacote', () => {
    const pacote = new PacoteServico('Pacote', ModoExecucao.SEQUENCIAL, [edicao()]);
    (pacote.listarSubservicos() as ServicoProjeto[]).pop();
    expect(pacote.listarSubservicos()).toHaveLength(1);
  });

  it('recusa ciclos: um pacote não pode conter a si mesmo, nem por um descendente', () => {
    const externo = new PacoteServico('Externo');
    const interno = new PacoteServico('Interno', ModoExecucao.SEQUENCIAL, [edicao()]);
    externo.adicionar(interno);

    expect(() => externo.adicionar(externo)).toThrow(/não pode conter a si mesmo/);
    expect(() => interno.adicionar(externo)).toThrow(/não pode conter a si mesmo/);
  });

  describe('validar()', () => {
    it('aprova uma hierarquia correta', () => {
      const pacote = new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
        new PacoteServico('Pós', ModoExecucao.PARALELO, [edicao(), mixagem()])
      ]);
      expect(pacote.validar()).toEqual({ valido: true, erros: [] });
    });

    it('reprova pacote vazio', () => {
      const resultado = new PacoteServico('Vazio').validar();
      expect(resultado.valido).toBe(false);
      expect(resultado.erros[0]).toMatch(/não contém nenhum serviço/);
    });

    it('encontra erros em qualquer profundidade e indica o caminho até eles', () => {
      const invalido = new ServicoAtomico('Mixagem', 'COZINHEIRO' as PapelTecnico, 100, 1);
      const projeto = new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
        new PacoteServico('Pós', ModoExecucao.SEQUENCIAL, [new PacoteServico('Som', ModoExecucao.SEQUENCIAL, [invalido])])
      ]);

      const resultado = projeto.validar();

      expect(resultado.valido).toBe(false);
      expect(resultado.erros).toHaveLength(1);
      expect(resultado.erros[0]).toMatch(/^Projeto › Pós › Som › Serviço "Mixagem": papel técnico inválido/);
    });

    it('acumula os erros de vários serviços', () => {
      const projeto = new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
        new ServicoAtomico('A', PapelTecnico.EDITOR, -5, 1),
        new ServicoAtomico('B', PapelTecnico.EDITOR, 5, 0)
      ]);
      expect(projeto.validar().erros).toHaveLength(2);
    });

    it('reprova o mesmo objeto presente duas vezes (custo e prazo seriam contados em dobro)', () => {
      const compartilhado = edicao();
      const pacote = new PacoteServico('Pacote', ModoExecucao.SEQUENCIAL, [compartilhado, compartilhado]);

      expect(pacote.validar().erros.join(' ')).toMatch(/aparece mais de uma vez/);
    });
  });

  it('clonar() copia a hierarquia inteira em profundidade', () => {
    const original = new PacoteServico('Projeto', ModoExecucao.PARALELO, [
      new PacoteServico('Pós', ModoExecucao.SEQUENCIAL, [edicao(), mixagem()])
    ]);

    const copia = original.clonar();
    (copia.listarSubservicos()[0] as PacoteServico).adicionar(vfx());

    expect(copia.calcularCusto()).toBe(original.calcularCusto() + 6000);
    expect(original.listarAtomicos()).toHaveLength(2);
    expect(copia.modoExecucao).toBe(ModoExecucao.PARALELO);
  });
});

describe('Composite — serialização', () => {
  const arvore = () =>
    new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [
      new PacoteServico('Pós', ModoExecucao.PARALELO, [edicao(), mixagem()]),
      vfx()
    ]);

  it('ida e volta preserva a estrutura, os custos e os prazos', () => {
    const original = arvore();
    const json = JSON.parse(JSON.stringify(serializarServico(original)));
    const recuperado = desserializarServico(json);

    expect(recuperado).toBeInstanceOf(PacoteServico);
    expect(recuperado.calcularCusto()).toBe(original.calcularCusto());
    expect(recuperado.obterPrazo()).toBe(original.obterPrazo());
    expect(serializarServico(recuperado)).toEqual(serializarServico(original));
  });

  it('assume modo SEQUENCIAL quando o pacote não informa o modo', () => {
    const pacote = desserializarServico({ tipo: 'PACOTE', nome: 'P', servicos: [] }) as PacoteServico;
    expect(pacote.modoExecucao).toBe(ModoExecucao.SEQUENCIAL);
  });

  it.each([
    ['valor que não é objeto', 'texto', /esperado um objeto/],
    ['tipo desconhecido', { tipo: 'COMBO', nome: 'X' }, /Tipo de serviço desconhecido/],
    ['pacote sem lista de serviços', { tipo: 'PACOTE', nome: 'X' }, /"servicos" é obrigatória/],
    ['modo de execução inválido', { tipo: 'PACOTE', nome: 'X', modoExecucao: 'CAOTICO', servicos: [] }, /modo de execução inválido/]
  ])('rejeita dados com %s', (_descricao, dados, mensagem) => {
    expect(() => desserializarServico(dados)).toThrow(ServicoInvalidoError);
    expect(() => desserializarServico(dados)).toThrow(mensagem);
  });

  it('limita a profundidade da hierarquia', () => {
    let no: unknown = { tipo: 'ATOMICO', nome: 'Folha', papel: 'EDITOR', custo: 1, prazoDias: 1 };
    for (let i = 0; i < 25; i++) no = { tipo: 'PACOTE', nome: `N${i}`, servicos: [no] };

    expect(() => desserializarServico(no)).toThrow(/excede 20 níveis/);
  });
});

describe('Composite — papéis exigidos pela hierarquia', () => {
  it('agrupa por papel distinto e pesa pela fatia do custo planejado', () => {
    const projeto = new PacoteServico('Projeto', ModoExecucao.SEQUENCIAL, [edicao(), coloracao(), mixagem()]);

    const papeis = papeisRequeridosDe(projeto);

    expect(papeis.map((p) => p.papel)).toEqual([PapelTecnico.EDITOR, PapelTecnico.SONOPLASTA]);
    expect(papeis[0].pesoImportancia).toBeCloseTo(6000 / 9000, 10); // edição + coloração
    expect(papeis[1].pesoImportancia).toBeCloseTo(3000 / 9000, 10);
    expect(papeis.reduce((soma, p) => soma + p.pesoImportancia, 0)).toBeCloseTo(1, 10);
  });

  it('divide o peso igualmente quando nenhum serviço tem custo', () => {
    const projeto = new PacoteServico('P', ModoExecucao.SEQUENCIAL, [
      new ServicoAtomico('A', PapelTecnico.EDITOR, 0, 1),
      new ServicoAtomico('B', PapelTecnico.DIRETOR, 0, 1)
    ]);
    expect(papeisRequeridosDe(projeto).map((p) => p.pesoImportancia)).toEqual([0.5, 0.5]);
  });

  it('servicoDePapeis() reparte o orçamento na proporção dos pesos', () => {
    const pacote = servicoDePapeis(
      [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 3 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 1 }
      ],
      8000
    );

    expect(pacote.calcularCusto()).toBeCloseTo(8000, 6);
    expect(pacote.listarAtomicos().map((s) => s.custo)).toEqual([6000, 2000]);
  });

  it('servicoDePapeis() divide igualmente quando todos os pesos são zero', () => {
    const pacote = servicoDePapeis(
      [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0 },
        { papel: PapelTecnico.EDITOR, pesoImportancia: 0 }
      ],
      1000
    );
    expect(pacote.listarAtomicos().map((s) => s.custo)).toEqual([500, 500]);
  });
});
