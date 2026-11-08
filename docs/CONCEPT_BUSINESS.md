# Concept: "Business" — a solo, strategy-first reimagining of the Indian Monopoly-style classic

> Status: **Concept / pre-validation.** Nothing here is validated yet. All numbers marked *(target)* are
> proposed goals, not measured facts. Working title only — final name needs a trademark check.
> This is a separate concept from the existing *Tilt* game in this repo.

---

## 1. One-liner

A 10–15 minute solo board-strategy game where you outplay AI rivals by trading, investing and timing
risk across a board of Indian cities — the "Business" game many of us grew up with, rebuilt for a phone
and for one player.

---

## 2. Background and opportunity

**The classic.** "Business" is the property-trading board game that generations of Indian kids played at
home. Players roll dice, buy properties, collect rent and bankrupt each other.

**Constraints of the original (the premise of this concept).** It was designed around a physical board
and a table of people:

| Original constraint | Effect on the player experience |
|---|---|
| Needs 3+ players in one room | Hard to play spontaneously or alone |
| Sessions run 1–3 hours | Rarely finished; players quit or fight |
| Dice dominate outcomes | Strategy matters less than luck in the middle game |
| Players can be eliminated early and then wait | Dead time and boredom |
| Manual bookkeeping (cash, rent, deeds) | Friction and arguments |
| Fixed board, fixed rules | No variety or progression |

**The opportunity.** A phone removes every one of these constraints. The game can be solo, short,
automatic and different every run.

---

## 3. Target audience

- **Primary:** Indian mobile casual gamers, Gen Z and millennials, roughly 16–40 *(assumption)*.
- **Millennials:** pulled by nostalgia for the original.
- **Gen Z:** most won't have played the original much, so the game must stand on its own through short
  runs, a daily challenge and shareable results.
- **Platform:** low-to-mid-range Android first, installable web/PWA. Must work offline.
- **Play style:** solo. Multiplayer is explicitly out of scope for v1.

---

## 4. Hypothesis

### Core hypothesis

> **If** we take the Indian "Business" board game and rebuild it as a short, solo, strategy-first mobile
> game, **then** Indian casual players aged 16–40 will play it repeatedly (not just try it once),
> **because** the original's constraints — long sessions, needing a group, luck-dominated outcomes, manual
> bookkeeping — are exactly what a phone can remove.

### Supporting hypotheses

| # | Hypothesis | Type |
|---|---|---|
| H1 | Players recognise and are drawn to an Indian "Business"-style theme without needing the original brand. | Desirability |
| H2 | A complete solo game against AI can be satisfying in 10–15 minutes. | Usability |
| H3 | Replacing luck with visible decisions (trades, investments, risk choices) makes wins feel earned. | Experience |
| H4 | A roguelite structure (run-based progression, unlocks) gives players a reason to come back. | Retention |
| H5 | Gen Z, who lack nostalgia, will play for the short-run loop and daily challenge. | Audience |
| H6 | AI rivals with distinct personalities feel like opponents, not scripts. | Feasibility |
| H7 | The game can run smoothly on low-end Android within a small download size. | Feasibility |

### Riskiest assumptions (test these first)

1. **Solo works for this game.** The original is social. A solo version might feel like an empty
   spreadsheet if the AI is dull. *(H2, H6)*
2. **Strategy-first is still fun for casual players.** Removing luck could make it feel like homework. *(H3)*
3. **Gen Z will care.** Without nostalgia, the theme alone may not pull them in. *(H5)*
4. **Market space.** Existing mobile board-trading games (notably Monopoly-branded mobile titles) may
   already satisfy the demand. A strategy-first solo game must be clearly different. *(H1)*

---

## 5. What "10x" means here

"10x" is only meaningful if it is measurable. Compared with the physical original, we aim for:

| Dimension | Original | Target for this game |
|---|---|---|
| Time to start a game | Find 2+ people, set up the board (10+ min) | Under 10 seconds *(target)* |
| Session length | 1–3 hours | 10–15 minutes *(target)* |
| Players needed | 3+ | 1 |
| Bookkeeping | Manual | None, fully automatic |
| Luck vs. skill | Mostly luck | Decisions drive the outcome *(see criteria)* |
| Replay variety | Same board every time | Different run each time (cities, events, rivals) |
| Dead time (eliminated, waiting) | Common | None |

---

## 6. Core experience (concept sketch)

**Setting.** A board of Indian cities and landmarks. Original names, art and board — no use of
Monopoly's or any other brand's marks, tokens or layout.

**A run, in short:**
1. Pick a starting "business persona" with a different perk.
2. Move around the board against 2–3 AI rivals.
3. Buy, upgrade and trade properties; manage cash and risk.
4. Respond to events (festivals, price shifts, policy changes) that reward planning.
5. Win by reaching a wealth goal or by being the last solvent player.
6. Earn run rewards that unlock new personas, events and rivals.

**Where strategy replaces luck (design intent):**
- Dice are replaced or softened — e.g. choose from a few movement options, or hold and re-roll limited
  times *(to be prototyped)*.
- Rival AIs have distinct personalities (aggressive buyer, cautious saver, trader).
- Events are telegraphed ahead of time so players can plan around them.

**Session shape:** a run is built to finish in 10–15 minutes, with a fast "one more run" restart.

---

## 7. Design pillars

1. **Decisions over dice.** Every turn offers a meaningful choice; luck adds flavour but does not decide
   the game.
2. **Short and complete.** A full game fits a commute.
3. **Alive opponents.** Rivals have personalities and make readable moves.
4. **Instantly Indian.** Cities, festivals, humour and Hinglish copy feel native, not translated.
5. **Fair and light.** No pay-to-win. Small download. Works offline on low-end phones.

---

## 8. Success criteria

Criteria are split into **validation gates** (is the concept worth building?) and **product metrics**
(is the built game working?). All thresholds are *proposed targets* to be confirmed against benchmarks
before use.

### 8.1 Concept validation gates (before a full build)

| Gate | Test | Pass threshold *(proposed)* |
|---|---|---|
| G1. Demand | Landing page + demo video, small paid test to Indian Android users | Sign-up/click-through rate clearly above the other concepts tested; absolute bar set once benchmark is known |
| G2. Comprehension | 5-second test: do viewers get "Indian Business, solo, strategy"? | ≥ 70% describe it correctly |
| G3. Fun (paper/digital prototype) | 8–12 target players complete one 15-minute game | ≥ 70% finish; ≥ 60% say they'd play again |
| G4. Strategy feel | Post-game question: "Did your decisions decide the outcome?" | ≥ 70% agree |
| G5. Opponent quality | Post-game question: "Did the rivals feel like real opponents?" | ≥ 60% agree |
| G6. Differentiation | Side-by-side with the closest existing mobile title | Majority of testers name a clear difference they value |

**Go / no-go rule:** proceed to MVP only if G3, G4 and G5 pass. If G1 fails, rework positioning before
spending on build. If G3 fails, the core loop needs redesign.

### 8.2 Product metrics (after launch)

| Metric | Target *(proposed)* |
|---|---|
| Tutorial completion | ≥ 80% |
| First game completion | ≥ 60% |
| Average session length | 10–15 min |
| Day-1 retention | ≥ 35% |
| Day-7 retention | ≥ 12% |
| Runs per active day | ≥ 2 |
| Share rate of result cards | ≥ 5% of completed runs |
| Crash-free sessions | ≥ 99.5% |
| Cold start on a low-end Android device | ≤ 3 s |
| Download size | Small (target to be set in tech design) |

Retention figures are placeholders; casual-game benchmarks vary widely and should be checked before
being treated as commitments.

---

## 9. Goals

### North Star

**Completed runs per weekly active player.** It captures the whole thesis in one number: a game players
want to start, finish and repeat.

### Goals by horizon

| Horizon | Goal |
|---|---|
| **Validate** (first) | Pass gates G1–G6 using a landing page and a playable prototype. |
| **MVP** | One complete solo mode: one board, 3 AI personalities, 3 personas, core events, offline play, a result share card. |
| **Launch** | Release on Android (and web/PWA) with a daily challenge and basic leaderboard. |
| **Grow** | Add boards (cities), personas, rivals and seasonal/festival content; evaluate monetisation. |

### Non-goals (v1)

- Real-time or turn-based multiplayer
- Real-money play of any kind
- Using any existing brand's name, art, board layout or tokens
- Cross-device accounts and cloud saves

---

## 10. Scope outline

**MVP (in scope):**
- One original board of Indian cities
- Property buying, rent, upgrades and simple trading
- 2–3 AI rivals with distinct personalities
- Event system (telegraphed events)
- Run structure, with a handful of unlockable personas
- Tutorial, offline support, shareable result card
- Hinglish-friendly copy

**Later:**
- Daily challenge and leaderboards
- More boards and regional editions
- Cosmetic customisation
- Seasonal and festival events

---

## 11. Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Trademark / IP | Monopoly and its board, tokens and wording are protected | Original name, board, art and rules wording; legal review before launch |
| Online gaming regulation in India | Rules around real-money online games have tightened | Free-to-play, no real-money elements; confirm the current legal position before launch |
| Crowded category | Existing mobile board-trading games may meet the need | Differentiate on solo, short, strategy-first; test G6 early |
| Solo feels empty | The original is social | Invest in AI personality; test G5 early |
| Complexity vs. casual audience | Strategy depth can overwhelm | Progressive tutorial; simple default mode |
| Low-end device performance | Primary audience devices are modest | Performance budget from day one |
| AI quality | Weak AI makes the game dull or unfair | Iterate AI on paper/digital prototype before full build |

---

## 12. Validation plan

1. **Landing-page demand test** — compare this concept against 1–2 others (e.g. Snake roguelite, Bagh-Chal).
2. **Paper or clickable prototype** — one board, simplified rules; playtest with 8–12 target players.
3. **Playable digital prototype** — core loop plus 2 AI personalities; measure G3–G5.
4. **Competitive teardown** — compare against the closest existing mobile titles on time-to-play,
   session length, depth and monetisation.
5. **Decision checkpoint** — apply the go/no-go rule in §8.1.

---

## 13. Open questions

- What movement/dice mechanic best removes luck while staying familiar?
- How much trading depth can a casual audience handle in 10–15 minutes?
- Should v1 have a single board or a few city-themed boards?
- What is the right monetisation model (cosmetics, optional ad-supported hints, premium unlock)?
- Which regional languages come after Hinglish?
- What is the final name, and does it clear a trademark check?

---

## 14. Related docs

- `docs/PRD.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md` — documents for the existing *Tilt* game
  in this repo (separate project, listed for convention reference only).
