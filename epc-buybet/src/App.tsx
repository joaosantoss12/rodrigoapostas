import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

interface Pick {
  game: string
  bet: string
  odd: string
  analysis: string
  markets: string
  price: string
}

function SuccessPage() {
  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <h1>Pagamento Confirmado!</h1>
        <p>
          Obrigado pela tua compra. A análise e aposta serão enviadas para o
          teu email em breve.
        </p>
        <p className="success-sub">
          Se não receberes o email nos próximos minutos, verifica a pasta de
          spam.
        </p>
        <a href="/" className="btn-primary">
          Voltar ao Início
        </a>
      </div>
    </div>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className="faq-icon">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="faq-answer">{answer}</p>}
    </div>
  )
}

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pick, setPick] = useState<Pick>()
  const isSuccess = new URLSearchParams(window.location.search).get('success') === '1'

  useEffect(() => {
    if (isSuccess) window.scrollTo(0, 0)
  }, [isSuccess])

  useEffect(() => {
    supabase
      .from('picks')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPick(data)
      })
  }, [])

  const PRICE = pick ? `${pick.price}€` : '-€'

  if (isSuccess) return <SuccessPage />

  const handleBuy = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Erro ao processar o pagamento. Tenta novamente.')
      }
    } catch {
      setError('Não foi possível ligar ao servidor. Tenta mais tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {/* ── Background Image ── */}
      <div className="bg-image" />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-icon">⚽</span>
            <span className="logo-text">
              El Pedrito <span className="logo-highlight">Apostas</span>
            </span>
          </div>
          <button className="btn-nav" onClick={handleBuy} disabled={loading}>
            Comprar — {PRICE}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🏆 Análises Desportivas Premium</div>
          <h1 className="hero-title">
            A Aposta Certa,
            <br />
            <span className="gradient-text">Na Hora Certa.</span>
          </h1>
          <p className="hero-sub">
            Recebe a nossa análise detalhada e aposta recomendada
            diretamente no teu email. Sem subscrições. Sem complicações.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary btn-large"
              onClick={handleBuy}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>Comprar Aposta</span>
                  <span className="btn-price">{PRICE}</span>
                </>
              )}
            </button>
            <p className="hero-guarantee">
              🔒 Pagamento seguro via Stripe · Entrega por email
            </p>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-bar">
        <div className="stats-inner">
          <div className="stat">
            <span className="stat-num">82%</span>
            <span className="stat-label">Taxa de Sucesso</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">1500+</span>
            <span className="stat-label">Apostadores Satisfeitos</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">5+</span>
            <span className="stat-label">Anos de Experiência</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">⚡</span>
            <span className="stat-label">Entrega Imediata</span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section how">
        <div className="container">
          <p className="section-tag">Simples e rápido</p>
          <h2 className="section-title">Como Funciona?</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">Passo [1]</div>
              <div className="step-icon">💳</div>
              <h3>Compras a Análise</h3>
              <p>
                Um pagamento único de {PRICE} via Stripe. Seguro e rápido.
              </p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">Passo [2]</div>
              <div className="step-icon">📧</div>
              <h3>Introduzes o Email</h3>
              <p>
                No checkout do Stripe, introduzes o teu endereço de email.
              </p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <div className="step-num">Passo [3]</div>
              <div className="step-icon">🎯</div>
              <h3>Recebes a Aposta</h3>
              <p>
                A análise detalhada e aposta recomendada chegam ao teu email em minutos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="section what">
        <div className="container">
          <div className="what-grid">
            <div className="what-text">
              <p className="section-tag">O que inclui</p>
              <h2 className="section-title">Tudo o que Precisas</h2>
              <p className="what-sub">
                Não perdes tempo a analisar estatísticas, históricos e odds.
                Nós fazemos isso por ti.
              </p>
              <ul className="what-list">
                {[
                  'Análise completa do jogo',
                  'Aposta recomendada com odd',
                  'Fundamentação e raciocínio da aposta',
                  'Mercados alternativos sugeridos',
                  'Entregue por email em minutos',
                  'Sem subscrição — pagas só quando queres',
                ].map((item) => (
                  <li key={item}>
                    <span className="check">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="what-card">
              <div className="card-header">
                <span className="card-tag">EXEMPLO DE EMAIL</span>
              </div>
              <div className="card-body">
                <div className="email-preview">
                  <div className="email-row">
                    <span className="email-label">Jogo</span>
                    <span>{pick?.game || '-'}</span>
                  </div>
                  <div className="email-row">
                    <span className="email-label">Aposta</span>
                    <span className="pick-highlight">{pick?.bet || '-'}</span>
                  </div>
                  <div className="email-row">
                    <span className="email-label">Odd</span>
                    <span className="odd-value">{pick?.odd || '-'}</span>
                  </div>
                  <div className="email-analysis">
                    <span className="email-label">Análise</span>
                    <p>{pick?.analysis || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="section pricing" id="pricing">
        <div className="container">
          <p className="section-tag">Preço justo</p>
          <h2 className="section-title">Um Preço, Zero Surpresas</h2>
          <div className="price-card-wrap">
            <div className="price-card">
              <div className="price-badge">COMPRA ÚNICA</div>
              <div className="price-amount">
                <span className="price-curr">€</span>
                <span className="price-num">14</span>
                <span className="price-dec">.99</span>
              </div>
              <p className="price-desc">
                Paga uma vez. Recebe a análise. Sem renovações automáticas.
              </p>
              <ul className="price-features">
                {[
                  'Análise completa por email',
                  'Aposta recomendada com odd',
                  'Entrega imediata após pagamento',
                  'Sem subscrição obrigatória',
                ].map((f) => (
                  <li key={f}>
                    <span className="check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="btn-primary btn-full"
                onClick={handleBuy}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : `Comprar por ${PRICE}`}
              </button>
              <p className="price-secure">🔒 Pagamento 100% seguro via Stripe</p>
              {error && <p className="error-msg">{error}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section faq">
        <div className="container container-sm">
          <p className="section-tag">Dúvidas frequentes</p>
          <h2 className="section-title">FAQ</h2>
          <div className="faq-list">
            <FAQItem
              question="Quando recebo a análise após o pagamento?"
              answer="A análise é enviada automaticamente para o teu email logo após a confirmação do pagamento, geralmente em menos de 5 minutos."
            />
            <FAQItem
              question="O pagamento é seguro?"
              answer="Sim. Utilizamos o Stripe, um dos processadores de pagamentos mais seguros do mundo. Os teus dados bancários nunca passam pelos nossos servidores."
            />
            <FAQItem
              question="Posso comprar várias análises?"
              answer="Claro! Cada compra é individual. Podes comprar sempre que quiseres uma nova análise."
            />
            <FAQItem
              question="E se não receber o email?"
              answer="Verifica a pasta de spam. Se ainda assim não encontrares, entra em contacto connosco que resolvemos de imediato."
            />
            <FAQItem
              question="Têm política de reembolso?"
              answer="Dado o caráter digital e imediato do produto, não fazemos reembolsos após a entrega da análise. Em caso de problemas técnicos, entra em contacto."
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo">
            <span className="logo-icon">⚽</span>
            <span className="logo-text">
              El Pedrito <span className="logo-highlight">Apostas</span>
            </span>
          </div>
          <p className="footer-disclaimer">
            ⚠️ Apostar pode criar dependência. Joga com responsabilidade. +18.
            As análises são de caráter informativo e não garantem resultados.
          </p>
          <p className="footer-copy">
            © {new Date().getFullYear()} El Pedrito Apostas. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
