import { AdaptadoresExternos } from '../../application/ports/AdaptadoresExternos';
import { AdaptadorArmazenamento } from '../../application/ports/AdaptadorArmazenamento';
import { AdaptadorPagamento } from '../../application/ports/AdaptadorPagamento';
import { AdaptadorProfissional } from '../../application/ports/AdaptadorProfissional';
import { RepositorioProfissionaisCompleto } from '../../application/services/RepositorioProfissionais';
import { AdaptadorGoogleCloud } from './armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from './armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from './armazenamento/AdaptadorS3';
import { ArmazenamentoExterno } from './armazenamento/ArmazenamentoExterno';
import { ClienteGoogleCloudSimulado } from './armazenamento/ClienteGoogleCloudSimulado';
import { ClienteS3Simulado } from './armazenamento/ClienteS3Simulado';
import { AdaptadorPagSeguro } from './pagamento/AdaptadorPagSeguro';
import { AdaptadorPayPal } from './pagamento/AdaptadorPayPal';
import { AdaptadorStripe } from './pagamento/AdaptadorStripe';
import { GatewayPagamento } from './pagamento/GatewayPagamento';
import { PagSeguroSimulado } from './pagamento/PagSeguroSimulado';
import { StripeSimulado } from './pagamento/StripeSimulado';
import { AdaptadorIndeed } from './profissionais/AdaptadorIndeed';
import { AdaptadorInterno } from './profissionais/AdaptadorInterno';
import { AdaptadorLinkedIn } from './profissionais/AdaptadorLinkedIn';
import { ApiProfissionalExterna } from './profissionais/ApiProfissionalExterna';
import { LinkedInSimulado } from './profissionais/LinkedInSimulado';

export const PROVEDORES_DE_ARMAZENAMENTO = ['local', 's3', 'google-cloud'] as const;
export const PROVEDORES_DE_PAGAMENTO = ['stripe', 'pagseguro', 'paypal'] as const;
export const PROVEDORES_DE_PROFISSIONAIS = ['interno', 'linkedin', 'indeed'] as const;

export interface ConfiguracaoDeIntegracoes {
  armazenamento: (typeof PROVEDORES_DE_ARMAZENAMENTO)[number];
  pagamento: (typeof PROVEDORES_DE_PAGAMENTO)[number];
  profissional: (typeof PROVEDORES_DE_PROFISSIONAIS)[number];
}

function escolher<T extends string>(variavel: string, valor: string | undefined, validos: readonly T[], padrao: T): T {
  const escolhido = (valor?.trim().toLowerCase() || padrao) as T;
  if (!validos.includes(escolhido)) {
    throw new Error(`${variavel}="${valor}" é inválido. Valores aceitos: ${validos.join(', ')}.`);
  }
  return escolhido;
}

/** Lê os provedores a usar das variáveis de ambiente (ADAPTADOR_ARMAZENAMENTO, ADAPTADOR_PAGAMENTO, ADAPTADOR_PROFISSIONAL). */
export function lerConfiguracaoDeIntegracoes(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDeIntegracoes {
  return {
    armazenamento: escolher('ADAPTADOR_ARMAZENAMENTO', env.ADAPTADOR_ARMAZENAMENTO, PROVEDORES_DE_ARMAZENAMENTO, 'local'),
    pagamento: escolher('ADAPTADOR_PAGAMENTO', env.ADAPTADOR_PAGAMENTO, PROVEDORES_DE_PAGAMENTO, 'stripe'),
    profissional: escolher('ADAPTADOR_PROFISSIONAL', env.ADAPTADOR_PROFISSIONAL, PROVEDORES_DE_PROFISSIONAIS, 'interno')
  };
}

export function criarAdaptadorDeArmazenamento(provedor: ConfiguracaoDeIntegracoes['armazenamento']): AdaptadorArmazenamento {
  switch (provedor) {
    case 's3':
      return new AdaptadorS3(new ClienteS3Simulado(), 'cinebridge-midia');
    case 'google-cloud':
      return new AdaptadorGoogleCloud(new ClienteGoogleCloudSimulado(), 'cinebridge-midia');
    case 'local':
      return new AdaptadorLocal(new ArmazenamentoExterno());
  }
}

export function criarAdaptadorDePagamento(provedor: ConfiguracaoDeIntegracoes['pagamento']): AdaptadorPagamento {
  switch (provedor) {
    case 'stripe':
      return new AdaptadorStripe(new StripeSimulado());
    case 'pagseguro':
      return new AdaptadorPagSeguro(new PagSeguroSimulado());
    case 'paypal':
      return new AdaptadorPayPal(new GatewayPagamento());
  }
}

export function criarAdaptadorDeProfissionais(
  provedor: ConfiguracaoDeIntegracoes['profissional'],
  repositorio: RepositorioProfissionaisCompleto
): AdaptadorProfissional {
  switch (provedor) {
    case 'linkedin':
      return new AdaptadorLinkedIn(new LinkedInSimulado());
    case 'indeed':
      return new AdaptadorIndeed(new ApiProfissionalExterna());
    case 'interno':
      return new AdaptadorInterno(repositorio);
  }
}

/** Monta o conjunto de adaptadores correspondente à configuração. */
export function criarAdaptadores(
  configuracao: ConfiguracaoDeIntegracoes,
  dependencias: { repositorioProfissionais: RepositorioProfissionaisCompleto }
): AdaptadoresExternos {
  return {
    armazenamento: criarAdaptadorDeArmazenamento(configuracao.armazenamento),
    pagamento: criarAdaptadorDePagamento(configuracao.pagamento),
    profissional: criarAdaptadorDeProfissionais(configuracao.profissional, dependencias.repositorioProfissionais)
  };
}
