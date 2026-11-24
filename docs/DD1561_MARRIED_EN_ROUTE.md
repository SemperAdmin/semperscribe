# DD 1561 - FSA When a Marine Marries En Route (research, 2026-11-24)

Status: research only, not implemented. Orchestrator verified FMR Vol 7A Ch 27 (Oct 2025) Table 27-1 notes 4 and 5 verbatim. JTR text was not readable here (hosts blocked); every JTR statement is [WS] unverified. Decisions for the owner are at the end of docs/DD1561_FSA_SPEC.md section R/S.


Prepared 2026-11-24. Research only; no repo edits.

## Labels and source status

- **[FMR27]** DoD 7000.14-R Vol 7A Ch 27, October 2025. Read all 36 pages from the owner's copy. This is the primary source for everything marked FMR27.
- **[FMR26]** FMR Vol 7A Ch 26, May 2025. Not in hand. The quotes come from docs/NAVMC_10922_SPEC.md §10a, which states they were taken verbatim from the full chapter: para 10.3 and Table 26-1.
- **[MCO1751]** MCO 1751.3 CH-1 as summarized in docs/NAVMC_10922_SPEC.md. Secondhand, through the spec.
- **[MCO1300]** MCO 1300.8 W/ADMIN CH-2 Ch 6 as cited in docs/NAVMC_11106_SPEC.md §3. Secondhand, through the spec.
- **[WS]** WebSearch result summaries only. The page was not opened, so treat these as unverified.
- **INFERENCE**: my own reasoning. No source states it.

**Hosts blocked from this session.** All failed with a CONNECT 403 or DNS failure:

- api.army.mil (JTR PDFs)
- www.mynavyhr.navy.mil (Navy FSA SOP Apr 2025, MILPERSMAN 7220-120)
- www.marines.mil (MCO 1300.8)
- dodsoco.ogc.osd.mil (JTR)

The earlier DD 1561 spec also lists these as blocked:

- comptroller.war.gov
- dfas.mil
- uscode.house.gov
- law.cornell.edu

**No JTR text was read.** Every JTR statement below is [WS].

---

## 0. The key fact: the FMR splits "en route" at the *effective date of the PCS order*

[FMR27 Table 27-1 note 4] defines the effective date of PCS orders as:

> "the date a member is required to begin travel from the old PDS or the last TDY or TAD, in order to arrive at the new PDS on the date authorized by the mode of transportation authorized" (JTR, Appendix A).

INFERENCE: this date is the report date minus authorized travel time. It is **not** the detachment date. Leave en route and proceed time therefore normally fall **before** the effective date. A Marine who marries on leave en route has normally married *after departure but before the effective date*. That case falls under Table 27-1 **rules 5–7**, not rules 8–13.

The rules group as follows:

| When acquired | Table 27-1 rules | Notes |
|---|---|---|
| After departure from the old station, on or before the effective date, PCS **overseas** | 5, 6 (FSA-R); 7 (FSA-T on TDY en route) | Note 4 |
| Same window, PCS **to CONUS or within CONUS** | none | Note 5: no FSA-R |
| After the effective date, before departure on the *next* PCS (includes "married after reporting") | 8 (not TDY), 9 (on leave), 10–12 (TDY), 13 (ship) | |
| Newly acquired dependent joins the member at the member's expense | 14, 15 | |

[FMR27 2.3.1.1.1] ties the FSA-R condition to this split:

> "The member's dependents, including dependents acquired after the effective date of [PCS] orders (see Table 27-1 ... rules 8 and 9), do not live in the vicinity of the member's homeport/PDS, and their transportation to or near the PDS is not authorized at government expense (see paragraph 4.1)."

---

## 1. FSA-R

### 1a. Married en route (on or before the effective date), PCS overseas

- **Rule 5** applies when the member "acquires an initial dependent after the date of departure from old station en route to PCS overseas, but no later than the effective date of the PCS order (FSA-R)" **and** "meets conditions of Table 27-2, rule 1". Rule 1 covers a member selected for PCS overseas where "the accompanied tour is not authorized", which per note 2 includes dependent-restricted tours and "situations where the member is not authorized to serve an accompanied-with-dependents tour in those locations where such tours are authorized".
  - Credit "starts on the date that a member acquires a dependent or the constructive date of detachment from old station (Table 27-2, rule 2), whichever is later" [FMR27 Table 27-1 rule 5].
  - The rule's cross-reference to "Table 27-2, rule 2" looks like a typo for Table 27-1 rule 2, the constructive-detachment rule. See section 8.
- **Rule 6** applies to the same acquisition window when the member "meets conditions of Table 27-2, rule 13, note 3, or rule 14". Credit "(if any) starts according to Table 27-2, rule 13, note 3, or rule 14" [FMR27 Table 27-1 rule 6]. This is the accompanied-area case where no tour election was made before arrival:
  - **Table 27-2 rule 13:** the member makes the unaccompanied election after arrival, so there is **no FSA-R for the entire unaccompanied tour**. Note 3 allows a Secretarial waiver under 4.1.4, effective on the date granted [4.1.4.3].
  - **Table 27-2 rule 14:** the member elects the accompanied tour after arrival, so FSA-R runs "for the period starting with the date the tour is approved through the day before dependents arrive at overseas station, not to exceed 60 days from date transportation of dependents is authorized, unless additional delay is caused by the government (note 5)".
- **No FSA-R for the en-route leave itself.** "Members are not entitled to FSA-R or FSA-T during authorized leave en route or proceed time" [FMR27 Table 27-4 note 4]. Rule 5's "whichever is later" has the same effect: a member who was single at detachment gets **no FSA for the leave en route**.
  - INFERENCE: FSA-R covers authorized travel days after the constructive detachment date.
- **Start date.** The start is the later of the marriage date and the constructive detachment date. The constructive detachment date is the actual detachment plus leave and proceed days, or the first day of authorized travel, whichever is later [Table 27-1 rule 2].
  - It is **not the report date**.
  - It is the **marriage date** only when the marriage falls after the constructive detachment date, for example on a travel day.

### 1b. Married en route, PCS to CONUS or within CONUS

[FMR27 Table 27-1 note 5]:

> "A member who acquired an initial dependent after the date of departure from old station en route PCS to CONUS from overseas or en route PCS within CONUS, but no later than the effective date of the PCS order, is entitled to travel for dependent at government expense based on JTR, Chapter 5. Therefore, the member is not entitled to FSA-R. (In this case, no tour election provision exists to overcome the travel provision.)"

So: **no FSA-R**, even if the spouse chooses not to move.

### 1c. Married after the effective date, including after reporting at the new PDS

- **Rule 8** (not on TDY) and **rule 9** (on leave, "co-resident with dependent or not") apply when the dependent is acquired "after the effective date of the PCS orders ... but before member's date of departure on subsequent reassignment PCS" and the "dependent does not live at or near the member's PDS". Then: "**starts FSA-R on date member acquires dependent**" [FMR27 Table 27-1 rules 8, 9].
- These rules are not limited to overseas.
  - INFERENCE: this applies at a CONUS PDS too. The basis is that a dependent acquired after the effective date generally has no government-funded travel to that PDS ([WS] JTR general rule: eligibility "is based on whether the individual is a dependent on the effective date of the PCS order"; [WS] DoDI 4515.13 and [WS] MCO 1300.8 on dependents acquired after the effective date).
- **Joining the member.** If the new spouse later joins at the member's expense, the outcome depends on whether the move is a change of residence or a temporary visit:
  - The test comes from para 3.2 or 3.3.3 [Table 27-1 rule 14].
  - A change of residence stops FSA the day before arrival [Table 27-3 rule 1].
  - A visit of up to 3 continuous months keeps FSA running [3.2.1].
  - If the spouse later moves away, FSA-R restarts on the day of departure [rule 15].
- **Gap.** The rule 8/9 parenthetical "(where member is not entitled to FSA-R)" is unexplained. See section 8.

### 1d. Single at detachment: FSA-R for the en-route period?

No. There is no dependent before the marriage, and FSA-R/T is barred during leave en route and proceed time [Table 27-4 note 4; Table 27-1 rule 5 "whichever is later"].

### 1e. Command sponsorship and accompanied vs unaccompanied

[FMR27 4.1.3.1] and [Table 27-2 rule 2] say electing unaccompanied where accompanied is authorized means no FSA-R, unless waived. Whether "not command-sponsored" yields FSA-R depends on **why** sponsorship was not given:

| Reason | FSA-R result | Source |
|---|---|---|
| Location is dependent-restricted, or the member is not authorized an accompanied tour there | Rule 5: entitled | Table 27-2 rule 1, note 2 |
| Concurrent travel or sponsorship **disapproved by the area commander** | FSA-R until the dependents arrive | Table 27-2 rule 6, qualified by rules 7–8 |
| Delay for government reasons: lack of transport, CONUS commander disapproval, health such as pregnancy, insufficient retainability or time left on tour | FSA-R | Table 27-2 note 5; note 6 (retainability, if the member applied timely) |
| Member did not apply, or did not comply with area entry regulations | FSA-R stopped | Table 27-2 rule 7 |
| Member elects unaccompanied after arrival | No FSA-R | Rule 13, waiver only |

Rule 6 cross-references only Table 27-2 rules 13 and 14 and note 3, not rules 4–8. That gap is flagged in section 8.

MCO 1300.8 points:

- **[MCO1300 via spec]** Acquired dependents need at least 12 months left on the tour after arrival or sponsorship approval, whichever is later (Ch 6 par 6.a, 7.b). The command may award sponsorship to an acquired dependent (par 6.e, 7.c).
- **[WS, MCO 1300.8 snippet]** "Marines who acquire dependents after the effective date of PCS orders to the overseas location have no entitlement to transoceanic travel of dependents and transportation of HHG to the overseas station, even if the dependents are subsequently granted command sponsorship."
  - This supports rules 8/9 FSA-R for post-effective-date acquisitions overseas: transport is not authorized at government expense even after sponsorship.
  - INFERENCE: the scenario's marriage (10 Mar) is before the effective date, so this bar should not apply. Travel from the place acquired may then be authorized if sponsorship is granted, and FSA-R would end under Table 27-2 rule 14 or the 60-day cap.

---

## 2. FSA-T and FSA-S when the marriage happens during a TDY or deployment already in progress

| Case | Start | Counting | Source |
|---|---|---|---|
| TDY en route to PCS overseas, member not entitled to FSA-R overseas | FSA-T for the TDY period **starts on the date acquired**, if 30 days or more remain after acquisition and the member is not within commuting distance | Counted from the **marriage date**. Note 1: do not pay "until ... more than 30 days after the date that a dependent is acquired" | Table 27-1 rule 7, note 1 |
| TDY after the effective date, not within commuting distance | FSA-T starts on the date acquired | Same note 1 test | Rules 10, 12 |
| TDY within commuting distance of the new spouse | No FSA-T; FSA-R starts on return to the PDS | | Rule 11 |
| Ship away from homeport | FSA-S starts on the date acquired, if the ship remains away more than 30 days after acquisition | | Rule 13, note 1 |

The 30-day test runs from the marriage date, not from the TDY or ship departure. Days before the marriage are not credited.

Mismatch to flag: rules 7 and 12 say "30 days or more remaining", but note 1 says "more than 30 days after". See section 8.

The usual counting rules still apply:

- 31st-day handling [4.4.1].
- Leave does not interrupt [4.4.1.5].
- TDY and ship days are not combined [4.4.5.1].

---

## 3. JTR interaction (all [WS]; JTR not read)

- **Acquired on or before the effective date:** dependent travel from the place acquired to the new PDS, capped at the old-PDS-to-new-PDS cost.
  - [WS: Coast Guard JTR supplement; DOHA Claims Appeals Board 2020-CL-072702.2, 7 Mar 2022]
  - This matches FMR27 note 5.
- **Acquired after the effective date:** no government-funded travel unless the JTR specifically authorizes it.
  - [WS: JTR eligibility language]
  - [WS: DoDI 4515.13 says such dependents travel only at personal expense or space-available]
  - [WS: JTR Table 5-37 summary on HHG]
  - [WS: PDTATAC change 45-26 on an IPCOT exception, where HHG is allowed if the dependent is command-sponsored at the current PDS]
- **OCONUS:** sponsorship is generally required before government-funded travel starts (JTR 050803, as cited in docs/NAVMC_11106_SPEC.md §3.4).
- **What decides FSA-R:** the decisive question is whether transportation to the PDS is **authorized at government expense** [FMR27 2.3.1.1.1, 4.1.1.1]. Whether the spouse actually moves does not decide it.
  - Once travel is authorized, for example after a post-arrival accompanied election or sponsorship, FSA-R runs only through the day before arrival, capped at 60 days from the authorization date unless the government causes the delay [Table 27-2 rules 8, 10, 14].
  - FSA-R stops the day before arrival [Table 27-3 rule 1].
- **Exact JTR paragraph numbers are unverified.** Search results disagree on 050106, which some editions show as "Isolation or Quarantine". Do not cite a JTR paragraph number in the app until it is read.

---

## 4. BAH/OHA, DEERS, NAVMC 10922, and backdating

- **BAH with dependents starts on the marriage date.** [FMR26 para 10.3]: "When a Service member acquires a dependent, for example, through marriage ... a with-dependent housing allowance is authorized as of the date the dependent is acquired." [FMR26 Table 26-1 rule 5]: a member who acquires a dependent "while in a duty status or on authorized leave, no Government quarters" starts on "the date the dependent is acquired".
  - In the scenario, that is 10 Mar, during leave en route.
  - Which rate location applies during PCS and at an OCONUS PDS with a non-sponsored spouse is governed by FMR26 Tables 26-21/26-22 (not in hand).
  - OHA with dependents depends on command sponsorship; a non-sponsored spouse does not support it [MCO1300/11106 spec §3, INFERENCE for OHA].
  - The likely result is BAH at the dependent's location or the old-PDS rate. **Open question; needs FMR Ch 26 §§ on unaccompanied OCONUS.**
- **Dependency in MCTFS.**
  - [MCO1751] A NAVMC 10922 is required for any dependent entering MCTFS.
  - Substantiating documents are due **within 30 days of the life event** (Ch 1 para 1.f).
  - The FMR date fixes the entitlement; the MCO clocks gate processing (docs/NAVMC_10922_SPEC.md §10a "MCTFS caveat").
- **DEERS.** No source ties FSA to DEERS enrollment. INFERENCE: DEERS is an ID and benefits record. It is not an entitlement date for FSA or BAH.
- **Can FSA be started or backdated before the dependency is recorded?**
  - FMR27 does not make MCTFS recording a condition of entitlement. Entitlement runs from the Table 27-1 date.
  - Retroactive credit has precedent: [FMR27 4.1.5 Example 2] shows dependency approved after arrival "retroactive to May 1", with FSA credited from detachment.
  - In practice, the DD 1561 block 14 certification ("receiving BAH ... as a member with dependents") cannot be made until the 10922 is approved and the dependency posted. INFERENCE: FSA starts in pay after approval, with a retroactive start to the FMR date.
  - The MCTFS TTC and retro-processing mechanics are unknown, which is an open question already noted in DD1561 spec D.
  - Claims older than 6 years are barred (31 U.S.C. 3702, general knowledge; not verified here).

---

## 5. Dual-military marriage en route

- [FMR27 2.3.4.1] FSA for a member married to a member requires that the members "were residing together immediately before being separated by reason of execution of military orders". [Table 27-4 rules 22 and 24] say the same.
- INFERENCE: if they married en route and **never resided together**, there is no FSA under 2.3.4. An active-duty spouse does not make the member "a member with dependents" [3.1.5], so rules 5–13 do not apply on the spouse's account either.
- Unresolved points:
  1. Does living together during the honeymoon or leave en route count as "residing together immediately before"? The FMR does not define it. The relevant precedents are probably 47 Comp Gen 788 and 60 Comp Gen 154, cited in FMR27 References and not read.
  2. Table 27-4 rule 23 says a member who "executes PCS orders causing a separation from the member's spouse" is entitled to FSA-R under 2.3.1.1, with no residing-together condition stated. It may conflict with 2.3.4.1 for dual-military couples.
  3. Under 2.3.4.1.1, payment goes to the member whose orders caused the separation, or the senior member if both depart the same day.
  4. If the couple later lives together and is separated again, 2.3.4.1.3 requires a reestablished joint household.

---

## 6. Timeline: single Marine detaches 1 Mar 2026, marries 10 Mar on leave en route, reports overseas 25 Mar, spouse not command-sponsored

Assumptions (INFERENCE, needed for dates):

- Leave en route is 2–22 Mar (21 days).
- Authorized travel is 23–24 Mar.
- Report date is 25 Mar.
- Effective date of the orders is 23 Mar (note 4: the date travel must begin to arrive on the authorized date).
- The marriage is therefore before the effective date, so rules 5/6 apply.

| Item | Effective date | Source |
|---|---|---|
| Dependency status (spouse) | 10 Mar (date of marriage) | FMR26 10.3; MCO1751 (10922, documents within 30 days, so by about 9 Apr) |
| BAH with dependents | 10 Mar. Rate location is an open question | FMR26 Table 26-1 rule 5 |
| BAH without dependents | Stops 9 Mar | 10922 spec §10a (Tables 26-21/22, cite only) |
| DEERS enrollment | Date processed. No entitlement effect found | INFERENCE |
| FSA during leave en route (2–22 Mar) | None | FMR27 Table 27-4 note 4 |
| FSA-R if the tour is restricted, or the member is not authorized an accompanied tour (Table 27-2 rule 1) | 23 Mar: the later of 10 Mar and the constructive detachment date (1 Mar + 21 = 22 Mar, or the first travel day 23 Mar, whichever later). Runs for the unaccompanied tour while the spouse is not at or near the PDS | Table 27-1 rules 2, 5; Table 27-2 rule 1 |
| FSA-R if the area is accompanied-authorized and sponsorship was disapproved by the area commander or delayed for government reasons | 23 Mar (INFERENCE by analogy to rule 5), through the day before the spouse arrives, subject to the 60-day cap | Table 27-2 rules 6–8, notes 5–6. Fit with rule 6 is unclear (section 8) |
| FSA-R if the member elects unaccompanied after arrival | None, unless a Secretarial waiver (effective on the date granted) | Table 27-1 rule 6; Table 27-2 rule 13, note 3; 4.1.4.3 |
| FSA-R if the member elects accompanied after arrival | From the date the tour is approved through the day before the spouse arrives, not more than 60 days from transport authorization unless the government causes the delay | Table 27-2 rule 14 |
| FSA-T/S | Not applicable unless there is TDY en route (rule 7: from 10 Mar if 30 or more days remained and not within commuting distance) | Table 27-1 rule 7, note 1 |
| Dependent travel entitlement | [WS] From the place acquired to the new PDS (capped), because acquired on or before the effective date, but only if command-sponsored (JTR 050803 per 11106 spec) and with 12 months on tour (MCO 1300.8 Ch 6 6.a/7.b). Not sponsored: no government-funded travel | [WS] CG JTR supplement, DOHA 2020-CL-072702.2 |
| FSA-R stop | Day before the spouse arrives to establish residence; or the day before arrival at the next non-qualifying station (constructive date) | Table 27-3 rules 1, 2 |

**Sensitivity.** If the Marine had married on 24 Mar, after the effective date, rule 9 would apply and FSA-R would start on 24 Mar. The same outcome holds for any marriage after reporting.

If this PCS were **within CONUS**, the en-route marriage would give **no FSA-R** at all (note 5).

---

## 7. What the DD 1561 (DEC 2017) shows in the scenario, and supporting documents

DEC 2017 numbering follows docs/DD1561_FSA_SPEC.md P1b: block 6 is the mobilized departure date and block 7 is the dependent address.

- **Block 5:** FSA-R.
- **Block 6:** blank. It is for mobilized RC members only.
- **Block 7:** the spouse's current address, needed for the "not at or near" test [FMR27 3.3].
- **Block 8a:** checked (married, not divorced or legally separated). 8b–8e are not applicable. 8f is checked only if the spouse is on active duty; then check "was" or "was not" residing together (see section 5).
- **Block 11:**
  - departed [old PDS] on `010326`;
  - leave en route `020326 - 220326` (app format `DDMMYY - DDMMYY`);
  - proceed time: none;
  - reported to [new PDS] on `250326`.
  - The printed statement "Transportation of dependent(s) is not authorized at government expense" must be true. It is true for Table 27-2 rule 1 restricted, rule 6 disapproved, or rules 8/9 post-effective-date cases. It is **false** if travel was authorized and the member simply did not use it.
  - **The form has no field for the date the dependent was acquired.** Block 11's dates give a start of 23 Mar here. That is correct only because the marriage preceded the constructive date. If the marriage came later, the certifier must use the marriage date, and the form will not show it.
- **Block 13:** PCS orders number or authority and date (the original orders; add modifications if any).
- **Block 14:** BAH with dependents confirmed. This needs the dependency approved in MCTFS (10922).
- **Blocks 9a and 16:** dates. The DD 1561 date is not the entitlement date.

Documents the certifier will likely want (INFERENCE unless cited):

- Marriage certificate, which supplies the acquisition date [FMR26 10.3; MCO1751 Ch 1 1.f].
- Approved NAVMC 10922, with the MCTFS dependency entry and BAH with dependents [block 14].
- DEERS enrollment, which IPACs commonly expect but no FSA source requires.
- PCS orders and endorsements showing detach, leave and report dates; leave record [Table 27-1 rule 2].
- Evidence of why transport is not authorized:
  - restricted-tour orders, or
  - a command sponsorship disapproval or denial message, or
  - an area-commander disapproval, or
  - a statement that the dependent was acquired after the effective date.
- The tour election, if any [Table 27-2 rules 13/14].
- The spouse's address or residence.
- If dual-military: the spouse's orders, EDIPI and branch, and evidence they resided together [FORM 8f; 2.3.4.1].

---

## 8. Conflicts, ambiguities, open questions (flagged, not resolved)

1. **Table 27-1 rule 5 cross-reference.** It says "constructive date of detachment from old station (Table 27-2, rule 2)", but Table 27-2 rule 2 is the unaccompanied-election bar. It probably means Table 27-1 rule 2. *Answer:* the FMR change history or DFAS.
2. **Rule 6 vs Table 27-2 rules 4–8.** For an en-route acquisition in an accompanied area where sponsorship is *disapproved* (as opposed to the member electing), rule 6 points only to rules 13 and 14 and note 3. Whether Table 27-2 rule 6 (disapproval gives FSA-R until arrival) applies is not stated. *Answer:* HQMC P&R (RFF) or a MCTFS/IPAC desktop procedure; the 3.3.4.4 determination route.
3. **Meaning of "effective date" with leave en route.** INFERENCE: the report date minus travel time. If an IPAC instead treats the detachment date as the effective date, every leave-en-route marriage moves to rules 8/9, and FSA-R starts on the marriage date. That changes the result. *Answer:* JTR Appendix A "Effective Date of PCS Order" text, and JTR Ch 5 dependent-acquired provisions (not read; hosts blocked).
4. **Rule 9 vs Table 27-4 note 4.** Rule 9 starts FSA-R on the acquisition date when "on leave". Note 4 bars FSA-R during leave en route. These reconcile only if rule 9's leave is leave after the effective date, which is not leave en route. Not stated. *Answer:* DFAS or RFF.
5. **"(where member is not entitled to FSA-R)"** in rules 8–13 is unexplained. It may mean the member was not already drawing FSA-R on other dependents.
6. **Rules 7/12 vs note 1.** Rules 7 and 12 say "30 days or more remaining". Note 1 says "more than 30 days after" acquisition. A remainder of exactly 30 days is ambiguous.
7. **TDY en route to a CONUS PDS, marriage during that TDY.** Rule 7 covers only PCS overseas. Note 5 says en-route CONUS acquisitions get travel and therefore no FSA-R. FSA-T for that TDY is not addressed.
8. **Dual-military residing-together test** for a couple married en route, and Table 27-4 rule 23 vs 2.3.4.1. *Answer:* 47 Comp Gen 788, 60 Comp Gen 154; DFAS.
9. **MCO 1300.8 transoceanic bar** [WS]: the current Ch 6 text is not read, and the 12-month rule varies by revision. *Answer:* MCO 1300.8 W/ADMIN CH-2 Ch 6 from marines.mil (blocked).
10. **BAH or OHA rate location** during en-route acquisition and for a non-sponsored spouse at an OCONUS PDS. *Answer:* FMR Ch 26 Tables 26-21/26-22 and the unaccompanied-OCONUS sections.
11. **MCTFS mechanics:** TTCs and retro start, whether FSA can be reported before the dependency posts, and the late-submission consequence under MCO 1751.3. *Answer:* MCTFS PRIUM (MCO P1080.40), Codes Manual, IPAC desktop procedures.
12. **Navy FSA SOP Apr 2025** [WS] says FSA "becomes effective on the 31st day of separation; retroactive to first day". That contradicts FMR27 for FSA-R, which has no 30-day test. It is Navy guidance, not Marine.
13. **App intro text.** "Answer for the day you received the orders" (Dd1561Sections.tsx step 1) gives the wrong frame for a member who married after receiving orders. A Marine single on that day would answer "never married" and be hard-stopped.

---

## 9. Suggested app changes (for owner decision)

**Data**

- `dd1561DependentAcquiredDate`: date of marriage or birth when it is after detachment.
- `dd1561PcsOverseas` (yes/no).
- `dd1561OrdersEffectiveDate`: computed as report date minus authorized travel days, editable.
- `dd1561TravelDays`: authorized travel days.
- `dd1561SponsorshipStatus`: restricted / disapproved-by-area-commander / government-delay / elected-unaccompanied / elected-accompanied-after-arrival / approved.
- `dd1561TourApprovedDate`.
- `dd1561TransportAuthorizedDate`.
- Dual-military: "date married" and "ever resided together before separation".

**Rules**

- Classify the acquisition as before or after the constructive detachment date, before or on the effective date, or after the effective date. Then:
  - CONUS and on or before the effective date: block, citing note 5.
  - Overseas and on or before the effective date: rule 5, start = later(acquired, constructive). Or rule 6, routed to Table 27-2 rules 13 and 14.
  - After the effective date: rules 8/9, start = acquired date. Rules 10–13 for TDY or ship, with the 30-day test counted from the acquired date.
- Warn when the start date computed from block 11 differs from the FMR start (marriage after the constructive date), because the form cannot show it. Suggest a continuation or remarks page.
- No FSA for any leave or proceed days before the marriage.
- Enforce the 60-day cap for Table 27-2 rules 8, 10 and 14.

**Help text**

- Reword the step-1 intro to "Answer as of today; if you married or gained a dependent after you received orders, tell us the date".
- Explain that "not command-sponsored" alone does not decide FSA-R. The reason does.
- List the documents in section 7.
- Note that the 10922 must be submitted within 30 days, and that FSA starts in pay after the dependency posts, retroactive to the FMR date (INFERENCE; label it as such).
