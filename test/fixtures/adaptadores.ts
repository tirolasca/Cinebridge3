import { AdaptadoresExternos } from '../../src/application/ports/AdaptadoresExternos';
import { Avaliacao } from '../../src/domain/entities/Avaliacao';
import { PapelTecnico } from '../../src/domain/entities/types';
import {
  RepositorioProfissionais,
  RepositorioProfissionaisCompleto
} from '../../src/application/services/RepositorioProfissionais';
import { AdaptadorLocal } from '../../src/infrastructure/integracao/armazenamento/AdaptadorLocal';
import { ArmazenamentoExterno } from '../../src/infrastructure/integracao/armazenamento/ArmazenamentoExterno';
import { AdaptadorStripe } from '../../src/infrastructure/integracao/pagamento/AdaptadorStripe';
import { StripeSimulado } from '../../src/infrastructure/integracao/pagamento/StripeSimulado';
import { AdaptadorInterno } from '../../src/infrastructure/integracao/profissionais/AdaptadorInterno';

/** Completa um repositório que só sabe buscar por papel, para uso no AdaptadorInterno. */
export function completarRepositorio(repositorio: RepositorioProfissionais): RepositorioProfissionaisCompleto {
  const buscarPorId: RepositorioProfissionaisCompleto['buscarPorId'] = async (id) => {
    for (const papel of Object.values(PapelTecnico)) {
      const encontrado = (await repositorio.buscarPorPapel(papel)).find((p) => p.id === id);
      if (encontrado) return encontrado;
    }
    return null;
  };

  return {
    buscarPorPapel: (papel) => repositorio.buscarPorPapel(papel),
    buscarPorId,
    registrarAvaliacao: async (id, avaliacao) => {
      const profissional = await buscarPorId(id);
      if (!profissional) return false;
      profissional.avaliacoes = [...profissional.avaliacoesSeguras, new Avaliacao(avaliacao.nota, avaliacao.projetoId, avaliacao.comentario ?? null)];
      return true;
    }
  };
}

/** Conjunto de adaptadores para testes: armazenamento local, Stripe simulado e cadastro interno sobre o repositório dado. */
export function criarAdaptadoresDeTeste(
  repositorio: RepositorioProfissionais = { buscarPorPapel: async () => [] }
): AdaptadoresExternos {
  return {
    armazenamento: new AdaptadorLocal(new ArmazenamentoExterno()),
    pagamento: new AdaptadorStripe(new StripeSimulado()),
    profissional: new AdaptadorInterno(completarRepositorio(repositorio))
  };
}
