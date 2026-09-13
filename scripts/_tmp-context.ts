import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

async function main() {
  const main = neon(process.env.DATABASE_URL!)
  const pf = neon(process.env.PORTFOLIO_DATABASE_URL!)

  const ideas = await main`
    select distinct on (ticker) ticker, exchange, direction, status, date,
      entry_low, entry_high, stop_loss, target_1, target_2, thesis
    from ideas order by ticker, date desc, id desc`
  const lastNote = await main`select date, top_call from morning_notes order by date desc limit 1`
  const lastInsight = await main`select date, body, bullets, actions from portfolio_insights order by date desc limit 1`
  const pos = await pf`
    select symbol, name, type, quantity, buy_price, current_price, buy_date, last_updated
    from positions where user_id='demo-user' order by type, symbol`

  console.log(JSON.stringify({
    aktifFikirler: ideas.filter((i:any)=>['active','review'].includes(i.status)),
    terminalFikirler: ideas.filter((i:any)=>!['active','review'].includes(i.status)).map((i:any)=>({t:i.ticker,s:i.status})),
    sonBulten: lastNote[0],
    sonAnaliz: lastInsight[0],
    pozisyonlar: pos,
  }, null, 2))
}
void main()
