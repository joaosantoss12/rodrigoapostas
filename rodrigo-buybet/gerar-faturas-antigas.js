import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Carrega as variáveis do ficheiro .env temporário
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const account = process.env.INVOICEXPRESS_ACCOUNT;
const apiKey = process.env.INVOICEXPRESS_API_KEY;

// Função para pausar a execução e evitar bloqueios da API por excesso de velocidade
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Função para Gerar Fatura no InvoiceXpress ──────────────────────────
async function createInvoiceXpress(email, amountTotalCents, dataPagamentoStripe) {
  const total = amountTotalCents / 100;
  const unitPrice = (total / 1.23).toFixed(2);
  
  // Usamos a data de hoje para a emissão para não quebrar a sequência cronológica da AT
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  try {
    // 1. Criar Rascunho da Fatura Simplificada
    const createRes = await fetch(`https://${account}.app.invoicexpress.com/simplified_invoices.json?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        invoice: {
          date: dateStr,
          due_date: dateStr,
          reference: `Stripe: ${dataPagamentoStripe}`, // Fica registado na fatura o dia do pagamento original
          client: {
            name: "Consumidor Final",
            email: email,
            country: "Portugal"
          },
          items: [
            {
              name: "Análise Desportiva Premium",
              unit_price: unitPrice,
              quantity: 1,
              tax: { name: "IVA23" }
            }
          ]
        }
      })
    });

    const data = await createRes.json();
    if (!data.simplified_invoice) {
      console.error(`[Erro] Falha ao criar rascunho para ${email}:`, data);
      return false;
    }

    const invoiceId = data.simplified_invoice.id;

    // 2. Finalizar a fatura
    await fetch(`https://${account}.app.invoicexpress.com/simplified_invoices/${invoiceId}/change-state.json?api_key=${apiKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        invoice: { state: "finalized" }
      })
    });

    console.log(`✅ Fatura gerada com sucesso para: ${email} | Valor: ${total}€`);
    return true;
  } catch (err) {
    console.error(`❌ Erro de ligação para ${email}:`, err.message);
    return false;
  }
}

// ── Motor Principal ──────────────────────────────────────────────────────
async function main() {
  console.log("🚀 A iniciar a sincronização de faturas antigas...");
  console.log("A procurar pagamentos concluídos no Stripe...\n");

  let contagem = 0;
  let ignorados = 0;

  try {
    // O Stripe auto-paginação: vai buscar TODOS os pagamentos concluídos no teu histórico
    // O 'expand' permite-nos ver dentro da cobrança para detetar reembolsos
    for await (const session of stripe.checkout.sessions.list({ 
      limit: 100, 
      status: 'complete',
      expand: ['data.payment_intent.latest_charge'] 
    })) {
      const email = session.customer_details?.email;
      const amount = session.amount_total;
      
      // Verifica se existe algum reembolso (parcial ou total) na cobrança
      const charge = session.payment_intent?.latest_charge;
      const foiReembolsado = charge?.refunded || (charge?.amount_refunded > 0);

      // Se foi reembolsado ou se o dinheiro não chegou a entrar, ignora e avança!
      if (foiReembolsado || session.payment_status !== 'paid') {
        console.log(`⏭️ Ignorado (Reembolsado/Não Pago): ${email || 'Sem email'}`);
        ignorados++;
        continue; 
      }
      
      // Formatar a data original do pagamento para colocar como observação
      const dataOriginal = new Date(session.created * 1000).toLocaleDateString('pt-PT');

      if (email && amount) {
        // Gera a fatura
        const sucesso = await createInvoiceXpress(email, amount, dataOriginal);
        
        if (sucesso) {
          contagem++;
          await sleep(1500); // Pausa obrigatória para não bloquear a API do InvoiceXpress
        }
      }
    }

    console.log(`\n🎉 Processo concluído!`);
    console.log(`✅ Geradas: ${contagem} faturas válidas.`);
    console.log(`⏭️ Ignoradas: ${ignorados} pagamentos (Reembolsos/Incompletos).`);

  } catch (error) {
    console.error("\n❌ Erro fatal ao ler dados do Stripe:", error.message);
  }
}

// Inicia o script
main();