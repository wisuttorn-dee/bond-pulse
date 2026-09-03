# Bond Pulse

Bond Pulse is a 15-minute, Kahoot-style classroom game for complete finance beginners. It teaches one core Bond Valuation relationship before introducing formulas:

**Market interest rate ↑ → existing fixed-coupon bond price ↓**  
**Market interest rate ↓ → existing fixed-coupon bond price ↑**

## Classroom flow

- Instructor creates a 6-digit Room Code.
- Students join with Room Code + nickname only. No account or registration.
- Five rounds, with no speed-based scoring.
- Instructor sees live participation and answer distribution.
- Final class accuracy, completion rate, round-by-round accuracy, and debrief prompts.

## 15-minute lesson

- Intro: 3 minutes
- Game: 8 minutes
- Debrief: 4 minutes

## Five rounds

1. Market rate 5% → 7%: price down, Discount Bond
2. Market rate 5% → 3%: price up, Premium Bond
3. Market rate 5% = 5%: price ≈ Par Value
4. Inflation raises market rate 5% → 6%: price down
5. Rate-cut expectations lower market rate 5% → 4%: price up

## Stack

- Static HTML/CSS/Vanilla JavaScript, no build step
- Supabase PostgreSQL RPCs for persistence
- Supabase Realtime Broadcast for instant refresh
- 2.5-second polling fallback if Realtime is unavailable

The frontend uses Supabase's public publishable key. It never uses a secret or service-role key.

## Security model

Students do not authenticate. The database issues unguessable per-room and per-player capability UUIDs. Browser clients have no direct table privileges. All table access occurs through RPC functions that validate the relevant capability token. RLS is enabled on all public game tables.

## Local use

Serve the repository with any static web server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

Opening `index.html` directly with a `file://` URL is not recommended because browser module/CORS rules vary.

## Supabase

Production project: `bond-pulse` in the `wisuttorn-dee` Supabase organisation, Singapore region.

To provision another Supabase project, apply:

`supabase/migrations/0001_bond_pulse.sql`

Then update `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `app.js`.

## Deployment

The project can be deployed as a static site on GitHub Pages, Netlify, Cloudflare Pages, or Vercel. No server-side application runtime is required.