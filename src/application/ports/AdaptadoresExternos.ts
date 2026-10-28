import { AdaptadorArmazenamento } from './AdaptadorArmazenamento';
import { AdaptadorPagamento } from './AdaptadorPagamento';
import { AdaptadorProfissional } from './AdaptadorProfissional';

/** O conjunto de adaptadores que o sistema de recomendação usa para falar com o mundo externo. */
export interface AdaptadoresExternos {
  armazenamento: AdaptadorArmazenamento;
  pagamento: AdaptadorPagamento;
  profissional: AdaptadorProfissional;
}
