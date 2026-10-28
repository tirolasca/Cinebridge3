import { SujeitoDeEventos, Observer } from '../../../src/domain/events/Observer';
import { NomeEvento, EventoDominio } from '../../../src/domain/events/EventosDominio';
import { ObservadorEmail } from '../../../src/domain/events/observadores/ObservadorEmail';
import { ObservadorMensagemInterna } from '../../../src/domain/events/observadores/ObservadorMensagemInterna';
import { ObservadorAuditoria } from '../../../src/domain/events/observadores/ObservadorAuditoria';
import { Recomendacao } from '../../../src/domain/entities/Recomendacao';
import { Convite } from '../../../src/domain/entities/Convite';
import { PapelTecnico, StatusConvite } from '../../../src/domain/entities/types';

describe('SujeitoDeEventos (Observer — sujeito)', () => {
  it('notifica todos os observadores inscritos para o mesmo evento', async () => {
    const sujeito = new SujeitoDeEventos();
    const chamadas: string[] = [];

    const observadorA: Observer = { nome: 'A', notificar: () => { chamadas.push('A'); } };
    const observadorB: Observer = { nome: 'B', notificar: () => { chamadas.push('B'); } };

    sujeito.inscrever(observadorA);
    sujeito.inscrever(observadorB);

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await sujeito.publicar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao });

    expect(chamadas.sort()).toEqual(['A', 'B']);
  });

  it('cada observador reage independentemente — falha em um não impede os demais', async () => {
    const sujeito = new SujeitoDeEventos();
    let observadorBFoiChamado = false;

    const observadorComFalha: Observer = {
      nome: 'ComFalha',
      notificar: () => {
        throw new Error('falha simulada no observador');
      }
    };
    const observadorSaudavel: Observer = {
      nome: 'Saudavel',
      notificar: () => {
        observadorBFoiChamado = true;
      }
    };

    sujeito.inscrever(observadorComFalha);
    sujeito.inscrever(observadorSaudavel);

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await expect(
      sujeito.publicar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao })
    ).resolves.not.toThrow();

    expect(observadorBFoiChamado).toBe(true);
  });

  it('permite desinscrever um observador', async () => {
    const sujeito = new SujeitoDeEventos();
    let chamado = false;
    const observador: Observer = { nome: 'X', notificar: () => { chamado = true; } };

    sujeito.inscrever(observador);
    sujeito.desinscrever(observador);

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await sujeito.publicar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao });

    expect(chamado).toBe(false);
    expect(sujeito.quantidadeDeObservadores()).toBe(0);
  });
});

describe('Observadores concretos — reações distintas ao mesmo evento', () => {
  function eventoConviteAceito(): EventoDominio {
    const convite = new Convite({
      projetoId: 'proj-1',
      profissionalId: 'prof-1',
      papel: PapelTecnico.DIRETOR,
      status: StatusConvite.ACEITO
    });
    return { tipo: NomeEvento.CONVITE_ACEITO, convite };
  }

  function eventoConviteRecusado(): EventoDominio {
    const convite = new Convite({
      projetoId: 'proj-1',
      profissionalId: 'prof-2',
      papel: PapelTecnico.EDITOR,
      status: StatusConvite.RECUSADO
    });
    return { tipo: NomeEvento.CONVITE_RECUSADO, convite, papelParaNovaRecomendacao: PapelTecnico.EDITOR };
  }

  function eventoEquipeFormada(): EventoDominio {
    return {
      tipo: NomeEvento.EQUIPE_FORMADA,
      projetoId: 'proj-1',
      composicaoFinal: [{ papel: PapelTecnico.DIRETOR, profissionalId: 'prof-1' }]
    };
  }

  it('ObservadorEmail delega ao remetente configurado', async () => {
    const chamadas: Array<{ destinatario: string; assunto: string }> = [];
    const observador = new ObservadorEmail((destinatario, assunto) => {
      chamadas.push({ destinatario, assunto });
    });

    await observador.notificar(eventoConviteAceito());

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].assunto).toBe('Convite aceito');
  });

  it('ObservadorEmail trata RECOMENDACAO_GERADA, CONVITE_RECUSADO e EQUIPE_FORMADA', async () => {
    const chamadas: Array<{ destinatario: string; assunto: string }> = [];
    const observador = new ObservadorEmail((destinatario, assunto) => {
      chamadas.push({ destinatario, assunto });
    });

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await observador.notificar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao });
    await observador.notificar(eventoConviteRecusado());
    await observador.notificar(eventoEquipeFormada());

    expect(chamadas).toHaveLength(3);
    expect(chamadas[0].assunto).toBe('Nova recomendação de equipe disponível');
    expect(chamadas[1].assunto).toBe('Convite recusado');
    expect(chamadas[2].assunto).toBe('Equipe formada com sucesso');
  });

  it('ObservadorMensagemInterna registra a mensagem publicada', async () => {
    const observador = new ObservadorMensagemInterna();
    await observador.notificar(eventoConviteAceito());

    const mensagens = observador.mensagensPublicadas();
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].texto).toContain('aceitou o convite');
  });

  it('ObservadorMensagemInterna trata RECOMENDACAO_GERADA, CONVITE_RECUSADO e EQUIPE_FORMADA, publicando quando configurado', async () => {
    const publicacoes: Array<{ destinatarioId: string; texto: string }> = [];
    const observador = new ObservadorMensagemInterna((destinatarioId, texto) => {
      publicacoes.push({ destinatarioId, texto });
    });

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await observador.notificar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao });
    await observador.notificar(eventoConviteRecusado());
    await observador.notificar(eventoEquipeFormada());

    expect(publicacoes).toHaveLength(3);
    expect(observador.mensagensPublicadas()).toHaveLength(3);
    expect(publicacoes[1].texto).toContain('recusou o convite');
    expect(publicacoes[2].texto).toContain('Equipe finalizada');
  });

  it('ObservadorAuditoria trata RECOMENDACAO_GERADA, CONVITE_RECUSADO e EQUIPE_FORMADA', async () => {
    const observador = new ObservadorAuditoria();

    const recomendacao = new Recomendacao({ projetoId: 'p1', estrategiaUtilizada: 'similaridade_cosseno' });
    await observador.notificar({ tipo: NomeEvento.RECOMENDACAO_GERADA, recomendacao });
    await observador.notificar(eventoConviteRecusado());
    await observador.notificar(eventoEquipeFormada());

    const registros = observador.obterRegistros();
    expect(registros).toHaveLength(3);
    expect(registros.map((r) => r.tipoEvento)).toEqual([
      NomeEvento.RECOMENDACAO_GERADA,
      NomeEvento.CONVITE_RECUSADO,
      NomeEvento.EQUIPE_FORMADA
    ]);
  });

  it('ObservadorAuditoria persiste o registro via callback quando configurado', async () => {
    const registrosPersistidos: unknown[] = [];
    const observador = new ObservadorAuditoria((registro) => {
      registrosPersistidos.push(registro);
    });

    await observador.notificar(eventoConviteAceito());

    expect(registrosPersistidos).toHaveLength(1);
  });

  it('ObservadorAuditoria grava um registro estruturado com timestamp', async () => {
    const observador = new ObservadorAuditoria();
    await observador.notificar(eventoConviteAceito());

    const registros = observador.obterRegistros();
    expect(registros).toHaveLength(1);
    expect(registros[0].tipoEvento).toBe(NomeEvento.CONVITE_ACEITO);
    expect(registros[0].timestamp).toBeInstanceOf(Date);
  });

  it('os três observadores produzem efeitos colaterais distintos e independentes para o mesmo evento', async () => {
    const sujeito = new SujeitoDeEventos();
    const chamadasEmail: string[] = [];

    const email = new ObservadorEmail((destinatario) => { chamadasEmail.push(destinatario); });
    const mensagemInterna = new ObservadorMensagemInterna();
    const auditoria = new ObservadorAuditoria();

    sujeito.inscrever(email);
    sujeito.inscrever(mensagemInterna);
    sujeito.inscrever(auditoria);

    await sujeito.publicar(eventoConviteAceito());

    expect(chamadasEmail).toHaveLength(1);
    expect(mensagemInterna.mensagensPublicadas()).toHaveLength(1);
    expect(auditoria.obterRegistros()).toHaveLength(1);
  });
});
