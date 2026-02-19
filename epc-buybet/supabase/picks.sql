-- Run this in: Supabase Dashboard → SQL Editor → New query

-- 1. Create the picks table
CREATE TABLE IF NOT EXISTS picks (
  id          SERIAL PRIMARY KEY,
  game        TEXT    NOT NULL DEFAULT '',           -- ex: "Benfica vs Porto"
  bet         TEXT    NOT NULL DEFAULT '',           -- ex: "Ambas Marcam - SIM"
  odd         TEXT    NOT NULL DEFAULT '',           -- ex: "1.85"
  analysis    TEXT    NOT NULL DEFAULT '',           -- análise detalhada
  markets     TEXT             DEFAULT '',           -- mercados alternativos (opcional)
  price       TEXT    NOT NULL DEFAULT '14.99',      -- preço em euros (sem símbolo)
  active      BOOLEAN NOT NULL DEFAULT true,         -- apenas 1 linha com active = true
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insert the first pick
INSERT INTO picks (game, bet, odd, analysis, markets, price, active)
VALUES (
  'Benfica vs Porto',
  'Ambas as equipas marcam - SIM',
  '1.85',
  'O Benfica marcou em todos os últimos 8 jogos em casa e tem o melhor ataque da liga. O Porto, apesar de jogar fora, é a equipa com mais golos marcados fora e tem dificuldade em manter a baliza a zero.',
  'Over 2.5 Golos @ 1.60',
  '14.99',
  true
);

-- Se a tabela já existe, adiciona a coluna price:
-- ALTER TABLE picks ADD COLUMN IF NOT EXISTS price TEXT NOT NULL DEFAULT '14.99';

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- 4. Permitir leitura pública
CREATE POLICY "Allow public read"
  ON picks
  FOR SELECT
  USING (true);

-- NOTA: Para atualizar a aposta do dia, vai ao Supabase → Table Editor → picks
-- e edita diretamente: game, bet, odd, analysis, markets, price
-- Garante que apenas 1 linha tem active = true
