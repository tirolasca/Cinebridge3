import { ServicoDeConvites } from '../../../src/application/services/ServicoDeConvites';
import { SujeitoDeEventos } from '../../../src/domain/events/Observer';
import { EventoDominio, NomeEvento } from '../../../src/domain/events/EventosDominio';
import { Convite } from '../../../src/domain/entities/Convite';
import { PapelTecnico, StatusConvite } from '../../../src/domain/entities/types';
import { criarProfissional, criarProjeto } from '../../fixtures/builders';

describe('ServicoDeConvites', () => {
  function criarConvite(parcial?: Partial<Convite>): Convite {
    return new Convite({
      projetoId: 'proj-1',
      profissionalId: 'prof-1',
      papel: PapelTecnico.DIRETOR,
      ...parcial
    });
  }

  it('aceitarConvite muda o status para ACEITO e publica o evento correspondente', async () => {
    const sujeito = new SujeitoDeEventos();
    const eventosPublicados: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventosPublicados.push(e); } });

    const servico = new ServicoDeConvites(sujeito);
    const convite = criarConvite();

    await servico.aceitarConvite(convite);

    expect(convite.status).toBe(StatusConvite.ACEITO);
    expect(eventosPublicados).toHaveLength(1);
    expect(eventosPublicados[0].tipo).toBe(NomeEvento.CONVITE_ACEITO);
  });

  it('recusarConvite muda o status para RECUSADO e retorna o papel para nova rodada', async () => {
    const sujeito = new SujeitoDeEventos();
    const servico = new ServicoDeConvites(sujeito);
    const convite = criarConvite({ papel: PapelTecnico.EDITOR });

    const papelRetornado = await servico.recusarConvite(convite);

    expect(convite.status).toBe(StatusConvite.RECUSADO);
    expect(papelRetornado).toBe(PapelTecnico.EDITOR);
  });

  it('equipeEstaCompleta retorna true somente quando todos os papéis têm convite aceito', () => {
    const sujeito = new SujeitoDeEventos();
    const servico = new ServicoDeConvites(sujeito);

    const convites = [
      criarConvite({ papel: PapelTecnico.DIRETOR, status: StatusConvite.ACEITO }),
      criarConvite({ papel: PapelTecnico.EDITOR, status: StatusConvite.PENDENTE })
    ];

    expect(
      servico.equipeEstaCompleta(convites, [PapelTecnico.DIRETOR, PapelTecnico.EDITOR])
    ).toBe(false);

    convites[1].aceitar();

    expect(
      servico.equipeEstaCompleta(convites, [PapelTecnico.DIRETOR, PapelTecnico.EDITOR])
    ).toBe(true);
  });

  it('finalizarComposicao publica EQUIPE_FORMADA quando a validação é bem-sucedida', async () => {
    const sujeito = new SujeitoDeEventos();
    const eventosPublicados: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventosPublicados.push(e); } });

    const servico = new ServicoDeConvites(sujeito);
    const projeto = criarProjeto({
      orcamentoTotal: 10000,
      papeisRequeridos: [{ papel: PapelTecnico.DIRETOR, pesoImportancia: 1 }]
    });
    const diretor = criarProfissional({ faixaDePreco: { minimo: 3000, maximo: 4000 } });
    const equipe = new Map([[PapelTecnico.DIRETOR, diretor]]);

    const resultado = await servico.finalizarComposicao(projeto, equipe);

    expect(resultado.validacao.valido).toBe(true);
    expect(resultado.relatorio.totalMembros).toBe(1);
    expect(eventosPublicados.some((e) => e.tipo === NomeEvento.EQUIPE_FORMADA)).toBe(true);
  });

  it('finalizarComposicao NÃO publica EQUIPE_FORMADA quando a validação falha', async () => {
    const sujeito = new SujeitoDeEventos();
    const eventosPublicados: EventoDominio[] = [];
    sujeito.inscrever({ nome: 'spy', notificar: (e) => { eventosPublicados.push(e); } });

    const servico = new ServicoDeConvites(sujeito);
    const projeto = criarProjeto({
      papeisRequeridos: [
        { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.5 },
        { papel: PapelTecnico.SONOPLASTA, pesoImportancia: 0.5 }
      ]
    });
    const diretor = criarProfissional();
    const equipe = new Map([[PapelTecnico.DIRETOR, diretor]]); // falta SONOPLASTA

    const resultado = await servico.finalizarComposicao(projeto, equipe);

    expect(resultado.validacao.valido).toBe(false);
    expect(eventosPublicados.some((e) => e.tipo === NomeEvento.EQUIPE_FORMADA)).toBe(false);
  });
});
