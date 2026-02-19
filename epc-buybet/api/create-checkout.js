import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout] STRIPE_SECRET_KEY is not set')
    return res.status(500).json({ error: 'Stripe não configurado.' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  try {
    // Fetch active price from Supabase
    const { data: pick } = await supabase
      .from('picks')
      .select('price')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const priceInCents = Math.round(parseFloat(pick?.price || '14.99') * 100)

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://elpedritoapostas.vercel.app'
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      locale: 'pt',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Análise Desportiva Premium',
              description:
                'Análise completa e aposta recomendada enviada diretamente para o teu email.',
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      billing_address_collection: 'auto',
      customer_creation: 'always',
      success_url: `${origin}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout]', err.message)
    res.status(500).json({ error: 'Não foi possível criar a sessão de pagamento.' })
  }
}
