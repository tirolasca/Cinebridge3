export class ErroStripe extends Error {
  constructor(readonly type: string, readonly code: string, message: string) {
    super(message);
  }
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'requires_payment_method' | 'refunded';
  metadata: Record<string, string>;
}

/**
 * Sistema externo simulado: imita a API do Stripe (`paymentIntents`,
 * `refunds`; valores em centavos; ids `pi_...`; status em inglês).
 * `limiteEmCentavos` permite simular recusas por valor.
 */
export class StripeSimulado {
  private readonly intents = new Map<string, PaymentIntent>();
  private contador = 0;

  constructor(private readonly limiteEmCentavos = Number.POSITIVE_INFINITY) {}

  readonly paymentIntents = {
    create: async (parametros: { amount: number; currency: string; metadata?: Record<string, string> }): Promise<PaymentIntent> => {
      this.contador += 1;
      const intent: PaymentIntent = {
        id: `pi_sim_${String(this.contador).padStart(6, '0')}`,
        amount: parametros.amount,
        currency: parametros.currency,
        status: parametros.amount > this.limiteEmCentavos ? 'requires_payment_method' : 'succeeded',
        metadata: { ...parametros.metadata }
      };
      this.intents.set(intent.id, intent);
      return { ...intent };
    },

    retrieve: async (id: string): Promise<PaymentIntent> => {
      const intent = this.intents.get(id);
      if (!intent) throw new ErroStripe('invalid_request_error', 'resource_missing', `No such payment_intent: ${id}`);
      return { ...intent };
    }
  };

  readonly refunds = {
    create: async (parametros: { payment_intent: string }): Promise<{ status: 'succeeded' }> => {
      const intent = this.intents.get(parametros.payment_intent);
      if (!intent) {
        throw new ErroStripe('invalid_request_error', 'resource_missing', `No such payment_intent: ${parametros.payment_intent}`);
      }
      if (intent.status === 'refunded') {
        throw new ErroStripe('invalid_request_error', 'charge_already_refunded', 'The charge has already been refunded.');
      }
      if (intent.status !== 'succeeded') {
        throw new ErroStripe('invalid_request_error', 'charge_not_refundable', 'The payment was never captured.');
      }
      intent.status = 'refunded';
      return { status: 'succeeded' };
    }
  };
}
