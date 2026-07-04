# Custom Rule Candidates — mined from all data (live + 834 archived events)

**Created:** July 2, 2026. Source: every live event + all 834 archived events (Oct 2025–Jul 2026). These are the "looks like an error but is normal for that gym" patterns Jayme should whitelist as per-gym rules. Build the "biggest first" ones at the top — they clear the most false flags.

## 🥇 Build first (highest false-flag volume)

1. **HGA KNO = pure theme names, NEVER says "Kids Night Out"** (~19 events): Boo Bash, Neon Night, Pajama Jam, Turkey Tumble, Holly Jolly Handstand, Wild West, Flips Fiesta, Go For Gold Olympics, K POP Demon Hunters, EGGstravaganza, etc. → EVERY HGA KNO flags as program mismatch. Whitelist HGA KNO theme-name pattern wholesale.
2. **RBA KNO = theme/party names, no "KNO"** (~18): Karaoke Night, Slime Night, Mad Scientist, Survivor Challenge, Wacky Hair Night, Tie Dye Night, PJ Party Palooza, Ice Cream Party, K-POP KARAOKE, etc. Same wholesale whitelist.
3. **OAS Open Gym renames** (~50 events): `Early Release/Homeschool Open Gym` (34) + `PRESCHOOL OPEN GYM` (16, walking age–4).
4. **Camp track names = CAMP** across EST/OAS/SGT/TIG/RBA/HGA: "Ninja Warrior", "Parkour & Ninja", "COED Ninja", "Girls Gymnastics", "Gymnastics/Ninja". Every camp is dual-listed under these names.

## Program name synonyms (= what program it really is)
- **OPEN GYM:** "Gym Fun Friday"/"Gym Fun Fridays" (CCP/CPF/CRR), "Preschool Fun Gym" (RBK, 14), "Homeschool Open Gym" (EST 10, CPF, TIG), "Early Release/Homeschool Open Gym" (OAS 34), "Preschool Open Gym" (OAS 16), "Open Tumble"/"Cheer Open Tumble"/"Tumbling" (RBA), "Open Workout" (CCP), "Bonus Tumbling & Open Gym" (RBK).
- **KIDS NIGHT OUT:** "Movie Night" (SGT 5x, OAS), all HGA + RBA theme names (above), RBK "___ KNO!" caps names.
- **CAMP:** Ninja Warrior / Parkour & Ninja / COED Ninja / Girls Gymnastics / Gymnastics-Ninja; dance camps (RBA "Dance Camp"/"K-POP Creative Dance Camp", RBK "Mermaid Mini Creative Dance Camp"); school-district camps (RRISD, HISD, NCISD, SUSD, "Chavez Huerta Day Camp").
- **CLINIC:** "Workshop" = clinic (CPF "Pullover and Handstand workshop", "Roundoff Back Handspring Workshop"); EST/SGT type as plain "Clinic" with skill only in the description.

## Valid time candidates (unusual but recurring per gym)
- OAS Open Gym 1:15–3:15 PM (31x) / 1:15–2:15 (early-release afternoon).
- EST Open Gym 7:30–9:30 PM (evening) + 1:00–2:00 (homeschool) — two very different OG times.
- HGA Open Gym 6:00–7:00 PM; HGA KNO starts 6:00 PM (30 min earlier than 6:30 norm).
- RBA/RBK KNO start 7:00 PM (not 6:30). TIG Open Gym 6:30–8:30 PM (night).
- Daytime clinics: HGA 12–1 / 1–2, RBA 12–1, RBK 12:30–2, EST 2–3, SGT 2–3 (most gyms clinic at 6:30 PM).

## Valid price candidates (per gym, fairly fixed = good anchors)
- OPEN GYM: CCP/CPF/CRR $10, RBK $15, HGA/OAS/RBA/TIG $20 (RBA occ. $25), SGT $30, EST $35 homeschool / $10 drop-in.
- KNO: CCP/CRR/EST $40, HGA/OAS/SGT $45, RBA/TIG $35–$40.
- CAMP full-week: RBA/RBK $250, CPF/CRR/OAS $315, EST $270, TIG $335, SGT $390, HGA $400. Half-day/day rates are a legit second price per gym.
- Showcase (SPECIAL EVENT): $20–$35 flat per gym.
- Sibling discount in KNO titles: "$40 (siblings $35)" (CCP/CRR/CPF) — whitelist the parenthetical.

## Age rules (unusual ranges that are normal for that gym)
- Preschool Open Gym mins drop to 0–1 (CCP 1-5, CPF 0-6/0-7, CRR 0-15/2-5, OAS 1-4, RBK 1-5).
- RBA/RBK skew older: clinics/OG 6–18 and 5–18. HGA Open Gym 7–17; HGA Ninja camp 7–12.
- AZ gyms (EST/OAS/SGT) camps 5–13 vs TX 4–12/4-13.

## Special Events / Showcases — IMPORTANT GAP
- 30 archived SPECIAL EVENTs (mostly March "Showcase" split by level/discipline). **SPECIAL EVENT is SKIPPED by ALL validation** — showcases get zero checks. If Jayme wants showcases validated (wrong date/age), that's a design decision when showcase season returns.
- Some showcase/fundraiser content is typed as CLINIC/KNO/OPEN GYM instead (Showcase Routines Clinic, Showcase Open Gym, IGT Team Bonding KNO, Caliber Fundraiser KNO, Cheer Fundraisers Open Gym, FALL FESTIVAL Open Gym) — those DO get checked; all intentional, whitelist if they flag.

## Xcel / team levels
- **NO "Xcel"/"compulsory"/"optional"/"bronze/silver/platinum"/"tryout" in ANY data** (live or 834 archive). Xcel clinics predate Oct 2025. The recurring team language is "IGT" (International Gymnastics Teams): CCP "IGT Routine Clinic", RBK "IGT Clinic", OAS "IGT Team Bonding" KNO, SGT "IGT Practice". "Xcel"/"Level" = team LEVEL, not a skill — won't trip the skill check.

## Real errors found in history (NOT rules — fix, don't whitelist)
- CRR Open Gym "10:00 PM–11:30 PM" (meant AM). RBK "Mommy & Me ... 11:00 PM" (meant AM). CPF "Gym Fun Friday 11:30pm" typo (21 live). OAS "BRING-A-FREIND" / "July 29nd". CPF clinic "(COPY)". SGT "Half Day" 9–10 AM 1-hr camps.
