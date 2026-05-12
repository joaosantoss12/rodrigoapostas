import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// ── Read raw body from stream (needed for Stripe signature verification) 
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Função para Gerar Fatura no InvoiceXpress ──────────────────────────
async function createInvoiceXpress(email, amountTotalCents) {
  const apiKey = process.env.INVOICEXPRESS_API_KEY;
  const account = process.env.INVOICEXPRESS_ACCOUNT;

  if (!apiKey || !account) {
    console.error('[InvoiceXpress] Chaves de API não configuradas.');
    return null;
  }

  // Calcula os valores: O Stripe envia em cêntimos (ex: 2000 = 20.00€)
  const total = amountTotalCents / 100;
  const unitPrice = (total / 1.23).toFixed(2); // Retira o IVA de 23%

  // Formata a data de hoje para DD/MM/YYYY
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  try {
    // 1. Cria a Fatura Simplificada (Fica em Rascunho)
    const createRes = await fetch(`https://${account}.app.invoicexpress.com/simplified_invoices.json?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        invoice: {
          date: dateStr,
          due_date: dateStr,
          client: {
            name: "Consumidor Final",
            email: email, // Guardamos o email na fatura para registo
            country: "Portugal"
          },
          items: [
            {
              name: "Análise Desportiva Premium",
              unit_price: unitPrice,
              quantity: 1,
              tax: { name: "IVA23" } // Usa a taxa padrão de 23%
            }
          ]
        }
      })
    });

    const data = await createRes.json();
    if (!data.simplified_invoice) {
      console.error('[InvoiceXpress] Falha ao criar rascunho:', data);
      return null;
    }

    const invoiceId = data.simplified_invoice.id;
    const pdfLink = data.simplified_invoice.permalink; // Link seguro para o cliente ver o PDF

    // 2. Finaliza a Fatura para ter validade fiscal
    await fetch(`https://${account}.app.invoicexpress.com/simplified_invoices/${invoiceId}/change-state.json?api_key=${apiKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        invoice: { state: "finalized" }
      })
    });

    console.log(`[InvoiceXpress] Fatura gerada com sucesso: ${pdfLink}`);
    return pdfLink;
  } catch (err) {
    console.error('[InvoiceXpress] Erro na API:', err.message);
    return null;
  }
}

// ── Webhook Handler Principal ──────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } else {
      console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification')
      event = JSON.parse(rawBody.toString())
    }
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_details?.email
    const amountTotal = session.amount_total // Valor total pago

    if (email) {
      try {
        // 1. Gera a fatura e obtém o link do PDF
        const invoiceLink = await createInvoiceXpress(email, amountTotal);
        
        // 2. Envia o email com a Aposta e com o Link da Fatura
        await sendPickEmail(email, invoiceLink);
        console.log(`[webhook] Pick email enviado para ${email}`)
      } catch (err) {
        console.error('[webhook] Failed to send email or invoice:', err.message)
      }
    }
  }

  res.status(200).json({ received: true })
}

// ── Fetch active pick from Supabase ────────────────────────────────────
async function getActivePick() {
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('active', true)
    .eq('seller', 'rodrigo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.error('[getActivePick] Supabase error:', error?.message)
    return {
      game: 'A revelar',
      bet: 'A revelar',
      odd: '—',
      analysis: 'A análise será enviada em breve.',
      markets: '',
    }
  }

  return data
}

// ── Send email via Brevo ───────────────────────────────────────────────
async function sendPickEmail(to, invoiceLink) {
  const pick = await getActivePick()

  // Bloco HTML condicional: só aparece se a fatura for gerada com sucesso
  const invoiceHtml = invoiceLink ? `
    <div style="margin-bottom:24px;padding:16px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:#F1F5F9;font-weight:600;">O teu pagamento foi processado com sucesso.</p>
      <a href="${invoiceLink}" style="color:#EAB308;text-decoration:none;font-weight:700;font-size:13px;" target="_blank">🔗 Consultar a minha Fatura Simplificada</a>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>A tua Aposta — Rodrigo Apostas</title>
  <style>
    @media only screen and (max-width:640px) {
      .email-outer { padding: 16px 8px !important; }
      .email-wrap  { width: 100% !important; max-width: 100% !important; }
      .body-pad    { padding: 20px 16px !important; }
      .stack-col   { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#080B10;font-family:'Inter',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-outer" style="background:#080B10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="900" cellpadding="0" cellspacing="0" class="email-wrap" style="max-width:900px;width:100%;">

          <tr>
            <td style="background:linear-gradient(135deg,#EAB308,#CA8A04);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
              <p style="margin:0 0 4px;color:rgba(0,0,0,0.6);font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Rodrigo Apostas</p>
              <h1 style="margin:0;font-size:28px;font-weight:900;color:#000;letter-spacing:-0.02em;">⚽ A tua Aposta chegou!</h1>
            </td>
          </tr>

          <tr>
            <td class="body-pad" style="background:#0E1318;border-radius:0 0 16px 16px;padding:32px;border:1px solid rgba(255,255,255,0.08);border-top:none;">

              <p style="margin:0 0 24px;color:#94A3B8;font-size:15px;line-height:1.6;">
                Obrigado pela tua compra! Aqui está a análise e aposta que preparámos para ti.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr valign="top">

                  <td class="stack-col" style="padding-right:${pick.image_url ? '10px' : '0'};">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141A22;border:1px solid rgba(234,179,8,0.25);border-radius:12px;overflow:hidden;">
                      <tr>
                        <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Jogo</p>
                          <p style="margin:6px 0 0;font-size:${pick.image_url ? '15px' : '18px'};color:#F1F5F9;font-weight:700;">${pick.game}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Aposta Recomendada</p>
                          <p style="margin:6px 0 0;font-size:${pick.image_url ? '16px' : '20px'};color:#EAB308;font-weight:800;">${pick.bet}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Odd</p>
                          <p style="margin:6px 0 0;font-size:${pick.image_url ? '20px' : '24px'};color:#22C55E;font-weight:800;">${pick.odd}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Análise</p>
                          <p style="margin:8px 0 0;font-size:13px;color:#94A3B8;line-height:1.7;">${pick.analysis}</p>
                        </td>
                      </tr>
                      ${pick.markets ? `
                      <tr>
                        <td style="padding:16px 24px;background:rgba(234,179,8,0.05);border-top:1px solid rgba(255,255,255,0.07);">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Mercados Alternativos</p>
                          <p style="margin:6px 0 0;font-size:13px;color:#94A3B8;line-height:1.6;">${pick.markets}</p>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>

                  ${pick.image_url ? `
                  <td class="stack-col" width="48%" style="padding-left:10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141A22;border:1px solid rgba(234,179,8,0.25);border-radius:12px;overflow:hidden;height:100%;">
                      <tr>
                        <td style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.07);">
                          <p style="margin:0;font-size:11px;color:#EAB308;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Aposta em imagem</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px;text-align:center;">
                          <img src="${pick.image_url}" alt="Aposta" width="100%" style="border-radius:8px;border:1px solid rgba(234,179,8,0.15);display:block;" />
                        </td>
                      </tr>
                    </table>
                  </td>` : ''}

                </tr>
              </table>

              ${invoiceHtml}

              <p style="margin:0 0 8px;font-size:12px;color:rgba(148,163,184,0.5);line-height:1.6;border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;">
                ⚠️ Esta análise é de caráter informativo. Apostar pode criar dependência. Joga com responsabilidade. +18.<br>
                Em caso de dúvidas contacta-nos através de rodrigoapostaspremium@gmail.com
              </p>
              <p style="margin:0;font-size:12px;color:rgba(148,163,184,0.4);">
                © ${new Date().getFullYear()} Rodrigo Apostas
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Rodrigo Apostas', email: process.env.BREVO_FROM_EMAIL },
      to: [{ email: to }],
      subject: '⚽ A tua Aposta chegou — Rodrigo Apostas',
      htmlContent: html,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Brevo API error ${response.status}: ${errBody}`)
  }
}