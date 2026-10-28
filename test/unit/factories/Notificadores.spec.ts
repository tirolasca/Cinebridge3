import { NotificadorDocumentario } from '../../../src/domain/factories/documentario/NotificadorDocumentario';
import { NotificadorAnimacao } from '../../../src/domain/factories/animacao/NotificadorAnimacao';
import { NotificadorPublicitario } from '../../../src/domain/factories/publicitario/NotificadorPublicitario';

describe('Notificadores concretos de cada família (Observador)', () => {
  it('NotificadorDocumentario registra o evento recebido', () => {
    const notificador = new NotificadorDocumentario();
    notificador.atualizar({ tipo: 'TESTE', dados: 1 });

    expect(notificador.obterNotificacoes()).toHaveLength(1);
    expect(notificador.obterNotificacoes()[0]).toEqual({ tipo: 'TESTE', dados: 1 });
  });

  it('NotificadorAnimacao registra o evento recebido', () => {
    const notificador = new NotificadorAnimacao();
    notificador.atualizar({ tipo: 'TESTE_ANIM' });

    expect(notificador.obterNotificacoes()).toHaveLength(1);
  });

  it('NotificadorPublicitario registra o evento recebido', () => {
    const notificador = new NotificadorPublicitario();
    notificador.atualizar({ tipo: 'TESTE_PUBLI' });

    expect(notificador.obterNotificacoes()).toHaveLength(1);
  });

  it('cada notificador acumula múltiplos eventos de forma independente', () => {
    const notificador = new NotificadorDocumentario();
    notificador.atualizar({ n: 1 });
    notificador.atualizar({ n: 2 });
    notificador.atualizar({ n: 3 });

    expect(notificador.obterNotificacoes()).toHaveLength(3);
  });
});
