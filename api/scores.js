// Serverless proxy for live World Cup scores.
// Keeps your football-data.org API key SECRET (it lives in an env var on the
// server, never in the browser). The page fetches "/api/scores" same-origin,
// so there are no CORS problems either.
//
// WORKS ON: Vercel (this file at /api/scores.js) and Netlify (see note at end).
//
// SETUP (2 minutes):
//   1. Sign up free at https://www.football-data.org  ->  copy your API token.
//   2. In your host dashboard add an Environment Variable:
//         Name:  FOOTBALL_DATA_KEY
//         Value: <your token>
//   3. Deploy. The page will start auto-filling results within a minute.

export default async function handler(req, res) {
  const KEY = process.env.FOOTBALL_DATA_KEY;
  if (!KEY) {
    res.status(500).json({ error: "FOOTBALL_DATA_KEY env var not set" });
    return;
  }
  try {
    const r = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": KEY } }
    );
    if (!r.ok) {
      res.status(r.status).json({ error: "upstream " + r.status });
      return;
    }
    const data = await r.json();
    // Trim to only what the page needs (smaller, faster, no leaking extras)
    const matches = (data.matches || []).map((m) => ({
      utcDate: m.utcDate,
      status: m.status,
      venue: m.venue || null,
      homeTeam: { name: m.homeTeam && m.homeTeam.name },
      awayTeam: { name: m.awayTeam && m.awayTeam.name },
      score: { fullTime: (m.score && m.score.fullTime) || {} },
    }));
    // Cache at the edge for 50s so we never exceed the 10 req/min free limit,
    // even with many visitors.
    res.setHeader("Cache-Control", "s-maxage=50, stale-while-revalidate=120");
    res.status(200).json({ matches });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}

/* ---------------------------------------------------------------------------
NETLIFY VERSION — if you host on Netlify instead of Vercel, ignore the code
above and create  netlify/functions/scores.js  with this body, then add the
same FOOTBALL_DATA_KEY env var in Site settings > Environment variables.
Also add a redirect in netlify.toml:  /api/scores  ->  /.netlify/functions/scores

    exports.handler = async () => {
      const KEY = process.env.FOOTBALL_DATA_KEY;
      if (!KEY) return { statusCode: 500, body: '{"error":"no key"}' };
      const r = await fetch(
        "https://api.football-data.org/v4/competitions/WC/matches",
        { headers: { "X-Auth-Token": KEY } }
      );
      const data = await r.json();
      const matches = (data.matches || []).map((m) => ({
        utcDate: m.utcDate, status: m.status, venue: m.venue || null,
        homeTeam: { name: m.homeTeam && m.homeTeam.name },
        awayTeam: { name: m.awayTeam && m.awayTeam.name },
        score: { fullTime: (m.score && m.score.fullTime) || {} },
      }));
      return {
        statusCode: 200,
        headers: { "content-type": "application/json",
                   "cache-control": "s-maxage=50" },
        body: JSON.stringify({ matches }),
      };
    };
--------------------------------------------------------------------------- */
