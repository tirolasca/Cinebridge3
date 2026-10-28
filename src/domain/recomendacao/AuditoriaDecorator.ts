import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';
import { RecomendadorDecorator } from './RecomendadorDecorator';

/** Registro estruturado de uma chamada ao recomendador. */
export interface RegistroDeRecomendacao {
  readonly timestamp: string;
  readonly recomendador: string;
  readonly tipoProjeto: string;
  readonly titulo: string;
  readonly candidatos: number;
  readonly membrosRecomendados: number;
  readonly duracaoMs: number;
  readonly sucesso: boolean;
  readonly erro?: string;
}

/** Destino dos registros de auditoria (memória, arquivo, serviço de logs...). */
export interface RegistradorDeAuditoria {
  registrar(registro: RegistroDeRecomendacao): void;
}

/**
 * Registrador em memória: guarda os últimos registros (descartando os mais
 * antigos ao passar da capacidade) e, opcionalmente, repassa cada um a outro
 * destino — por exemplo, a saída de logs do serviço.
 */
export class AuditoriaEmMemoria implements RegistradorDeAuditoria {
  private readonly registros: RegistroDeRecomendacao[] = [];
  private totalRegistrado = 0;

  constructor(
    private readonly capacidade = 1000,
    private readonly espelho?: (registro: RegistroDeRecomendacao) => void
  ) {}

  registrar(registro: RegistroDeRecomendacao): void {
    this.totalRegistrado += 1;
    this.registros.push(registro);
    if (this.registros.length > this.capacidade) this.registros.shift();
    this.espelho?.(registro);
  }

  /** Os registros mais recentes, do mais novo para o mais antigo. */
  ultimos(limite = 20): RegistroDeRecomendacao[] {
    return this.registros.slice(-limite).reverse();
  }

  total(): number {
    return this.totalRegistrado;
  }
}

/**
 * Decorator: registra cada chamada ao recomendador — quando ocorreu, para
 * qual projeto, quantos candidatos e membros, quanto tempo levou e se
 * terminou com sucesso ou erro — e então devolve (ou propaga) o resultado do
 * recomendador interno, sem alterá-lo.
 */
export class AuditoriaDecorator extends RecomendadorDecorator {
  readonly nome = 'auditoria';

  constructor(
    interno: RecomendacaoStrategy,
    private readonly registrador: RegistradorDeAuditoria,
    private readonly cronometro: () => number = () => performance.now()
  ) {
    super(interno);
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional> {
    const inicio = this.cronometro();
    const base = {
      timestamp: new Date().toISOString(),
      recomendador: this.interno.constructor.name,
      tipoProjeto: projeto.tipoProjeto,
      titulo: projeto.titulo,
      candidatos: profissionais.length
    };

    try {
      const resultado = this.interno.recomendar(projeto, profissionais);
      this.registrador.registrar({
        ...base,
        membrosRecomendados: resultado.size,
        duracaoMs: this.cronometro() - inicio,
        sucesso: true
      });
      return resultado;
    } catch (erro) {
      this.registrador.registrar({
        ...base,
        membrosRecomendados: 0,
        duracaoMs: this.cronometro() - inicio,
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro)
      });
      throw erro;
    }
  }
}
