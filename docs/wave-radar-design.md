# Wave Radar — design (v1)

The hero of the music/Culture front. An artist superpower: **see the wave before it breaks.**

## Core idea
**Emergence = acceleration, not size.** What's already big has peaked. A wave is what's
*climbing fast and speeding up off a low base.* This is LIMEN's phase math on music:
track a signal over time → velocity (Δrank/day) → acceleration (Δvelocity). Phase map:

| Phase | LIMEN | Meaning | Artist read |
|---|---|---|---|
| Emerging | P1 | fast climb from outside the top | **aim here** |
| Rising | P6 | steady mid-pack climb | catch it |
| Peaking | P7 | top + flattening | crowded, too late |
| Cooling | P3 | falling | avoid |

## The honest constraint
Acceleration needs **history**. The radar can't show velocity on day one — it **warms up**
by snapshotting over time. The engine's real job: sample real charts on a cadence, store the
time-series, compute emergence as it accrues. Sharper every day. (Not a flaw — that's radar.)

## Data
- **v1 (shipped): Deezer charts API — free, keyless.** 6 genre charts (overall/hiphop/pop/
  dance/rnb/rock), top 50 each. Snapshot on view, throttled 3h, accrues history from traffic.
- **Upgrade path (makes it lethal):** Shazam (pure discovery = best *leading* indicator),
  Last.fm (geo velocity — *where* it's rising), Spotify popularity delta, YouTube view velocity.
  Each needs an API key (operator). Composite emergence score across sources.

## Storage (cost-safe)
ONE Redis doc `wave:db` = `{ lastsnap, tracks:{ id:{meta, hist:[{t,p,g}]} } }`. A page view is
~1 read + (if stale) 1 write. No per-track fan-out (Redis request volume = the known cost risk).
Hist capped 48 points/track; tracks pruned after 16 days unseen.

## Files
- `handlers/wave-radar.js` — engine: fetch Deezer → snapshot → analyze() (velocity/accel/phase/
  emergence) → `{rising, peaking, cooling, warming}`. Registered in `api/[...route].js`.
- `wave-radar.html` (`/wave-radar`) — radar UI (Energy-grade), phase-colored, warming banner.
- Surfaced as the hero callout + nav link on `/culture` (the music front).

## emergence(track)
`emergence = max(0, vRecent)·(0.5 + 0.5·room) + max(0, accel)·0.6`, where `room = min(1, rank/50)`
(more room to grow at higher rank #). Phase thresholds in `analyze()`.

## Next
1. **Sound/scene clustering** — the real superpower: cluster tracks into sonic signatures
   (tempo/energy/valence + tags) so the radar surfaces *"jersey-club is emerging,"* not just tracks.
2. Add a leading signal (Shazam or Last.fm) for true pre-virality.
3. Geo ("where it's rising") + "closest uncrowded wave to YOUR sound."
4. Feed waves back into the Culture brain as nodes (artists/tracks/scenes) → connectome + lanes.

See memory: [[music-culture-front-dmad]], [[multimodal-interoception-northstar]].
