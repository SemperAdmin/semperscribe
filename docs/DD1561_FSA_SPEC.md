# DD Form 1561 - Family Separation Allowance (FSA) Spec

Prepared 2026-11-24. Phase 0 research for the SemperScribe DD 1561 guided form. No app code exists yet.

Status: research complete, design decisions open (section P). Sources marked [WS] are unverified search
excerpts; verify each against its primary page before any rule that depends on it ships.

Spot-verified by the orchestrator against the FMR copy: edition October 2025 (page 27-1), DD 1561 named as the
substantiating form (para 2.1), single-payment rule (2.1), and the FSA-T count-back rule (4.4.1, Example 1:
a 32-day absence earns 30 days of FSA-T from the constructive departure date, not from day 31).

## 0. Source status

Read in full:

- **[FMR]** DoD 7000.14-R, Financial Management Regulation (FMR), Volume 7A, Chapter 27, "Family Separation Allowance (FSA)", **edition dated October 2025** (supersedes the October 2023 edition). I read the user-supplied 36-page copy at `/root/.claude/uploads/288b8248-176d-583d-bbae-dd3c7f3ed593/4563eeeb-Vol07a_Ch27_Family_Separation_Allowance_FSA.pdf`. The official URL is https://comptroller.war.gov/Portals/45/documents/fmr/current/07a/07a_27.pdf. The comptroller site moved from comptroller.defense.gov to comptroller.war.gov. Paragraph and table citations below refer to this copy.
- **[FORM]** DD Form 1561, **NOV 2006** edition, read in full. I used the user-supplied copy at `/root/.claude/uploads/288b8248-176d-583d-bbae-dd3c7f3ed593/c966ccc1-dd1561.pdf`, which matches https://www.dfas.mil/Portals/98/dd1561.pdf.

Could not fetch. The session network blocks these hosts:

- uscode.house.gov
- law.cornell.edu
- marines.mil
- comptroller.war.gov
- dfas.mil

For those sources, the facts marked **[WS]** come only from WebSearch result excerpts (search-engine summaries of the pages), not from reading the page itself. Treat every [WS] item as **unverified until someone opens the primary page**. To let a later session read them directly, these hosts must be allowed in the environment network settings:

- uscode.house.gov
- www.marines.mil
- comptroller.war.gov
- www.dfas.mil
- www.esd.whs.mil
- www.mynavyhr.navy.mil

Not found at all:

- MCTFS PRIUM / IRAM unit-diary TTCs for FSA
- MCO 1751.3 text
- Any Marine Corps order on who certifies the DD 1561 or how long it is retained
- The text of the DD 1561 DEC 2017 edition

Labels used below: **[FMR]**, **[FORM]**, **[WS]**, and **INFERENCE** (my reasoning, not stated by a source).

---

## 1. Statute and current rate (37 U.S.C. § 427)

All items in this section are [WS] only. I could not open uscode.house.gov or Cornell.

- **Current rate.** 37 U.S.C. 427(a)(1) now reads "not less than $300, and not more than $400." Pub. L. 119-60 (FY2026 NDAA, enacted 18 Dec 2025) substituted "$300" for "$250".
  - Sources: https://uscode.house.gov/view.xhtml?req=granuleid%3AUSC-prelim-title37-section427&num=0&edition=prelim and https://www.law.cornell.edu/uscode/text/37/427 [WS]
  - One secondary site names the provision as **sec. 622** [WS: fedratecalc.com]. Unverified.
  - The FY26 NDAA Joint Explanatory Statement says the House bill proposed $400 and the conference set a $300 minimum: https://armedservices.house.gov/uploadedfiles/fy26_ndaa_joint_explanatory_statement.pdf [WS]
  - **The premise "FY2025 NDAA raised it" is wrong.** The change came in the **FY2026** NDAA, Pub. L. 119-60.
- **Marine Corps implementation: MARADMIN 150/26**, "Change to Family Separation Allowance (FSA) Rate", released 1 Apr 2026.
  - FSA goes from $250 to **$300/month, effective 18 Dec 2025**, the NDAA enactment date. The MARADMIN says the law set no other effective date.
  - Applies to FSA-R, FSA-S and FSA-T.
  - MCTFS has been updated, reportedly with an automated adjustment of eligible records.
  - References cited: FY26 NDAA (ref a); an OASW memo on FSA rates dated 23 Dec 2025 (ref c); FMR 7A Ch 27 (ref d).
  - Sources: https://www.marines.mil/News/Messages/Messages-Display/Article/4449907/change-to-family-separation-allowance-fsa-rate/ and https://www.maradmins.com/maradmin/maradmin-150-26 [WS]
- **Other statutory provisions** [WS, Cornell/FindLaw excerpts]:
  - **§ 427(c)(1):** No FSA when a member elects an unaccompanied tour at a station where dependent movement is authorized at government expense.
  - **§ 427(c)(2):** Exception when a dependent cannot accompany the member for certified medical reasons.
  - **§ 427(c)(3):** The Secretary concerned may waive (c)(1) for unusual family or operational circumstances.
  - **§ 427(d):** Member married to member. The FMR cites § 427(d) for its para 2.3.4.
  - **§ 427(b):** Covers a member who does not maintain a household for primary dependents. The FMR references cite § 427(b) for 2.3.2.
- **Stale amount in the FMR.** FMR para 2.3.2 still says "Effective October 1, 2002, FSA is payable in a monthly amount of $250." The October 2025 FMR predates the rate change, so **use $300 for periods on or after 18 Dec 2025 and $250 before** [FMR 2.3.2; WS MARADMIN 150/26].

---

## A. Eligibility

- **Who qualifies.** FSA is payable to "members with dependents and a member married to another member of the uniformed services regardless of any other dependency status" [FMR 2.1]. It is payable "to a member serving in any grade as a member with dependents" who meets all general requirements plus one of FSA-R, FSA-S or FSA-T [FMR 2.3.1].
- **One FSA at a time.** A member may not receive more than one FSA payment for the same period, even if qualified under more than one of R, S and T [FMR 2.1].
- **Form required.** The member must complete a DD 1561 [FMR 2.1].
- **No dependents means no FSA.** A member without dependents is ineligible, unless married to another member [FMR 2.1, 2.3.4.1]. INFERENCE: The app should hard-stop a single member with no dependents.
- **Permissive orders.** FSA is not authorized for duty under permissive orders, except as in 4.1.3 [FMR 1.1; 4.1.1.3].
- **Who counts as a dependent** [FMR 2.2.1.1–2.2.1.4]:
  - **Child:** Must be in the member's legal custody. Joint physical and legal custody counts when the child lives with the member at least 14 days a month. The arrangement must be shown by a signed court order, divorce decree, or notarized custody affidavit signed and sworn by the shared guardian.
  - **Parent and ward:** As defined in Vol 7A Definitions.
  - **Spouse:** The person legally married to the member.
- **Dual-military couples** [FMR 2.3.4]:
  - FSA is payable to a member married to a member regardless of non-active-duty dependents, **provided they were residing together immediately before being separated by execution of military orders** [2.3.4.1].
  - **Couple with no other dependents:** No more than one FSA per couple per month [2.3.4.1.1]:
    - Payment goes to the member whose orders caused the separation.
    - If both depart on the same day, the senior member is paid.
    - Entitlement can pass sequentially to the other member when the first one's entitlement ends [2.3.4.1.2].
    - To qualify again, the couple must re-establish a joint household [2.3.4.1.3].
  - **Couple with dependents** (e.g., children) who resided together with those dependents before both were separated by orders: **each member** may be paid FSA, with entitlement determined individually [2.3.4.2; Table 27-4 rule 24 and note 8]. This holds even if both are at the same location away from the dependents.
  - **Same child, both members:** Both cannot be paid FSA simultaneously on behalf of the same child, except under 2.3.4.2 [2.3.4.3].
  - **A dependent entitled to active-duty basic pay** disqualifies the member as a "member with dependents," but the member-married-to-member couple remains entitled [FMR 3.1.5].
- **Reserve Component members** [FMR 2.3.1.3 NOTE]:
  - For an RC member, the "PDS" for FSA-T is **the location from which the member is ordered to active duty or the place of entry to active duty**.
  - This does not apply to RC members on PCS orders, AGR members, or members activated long enough that the activation is a PCS.
  - The commuting-distance test (para 3.3.1) applies.
  - The DD 1561 block 10 uses "home of residence (HOR) pertains to reserve component" [FORM block 10].
- **Commuting distance / "at or near"** [FMR 3.3.1–3.3.3]:
  - No FSA accrues if *all* dependents reside at or near the duty station.
  - Dependents are "near" if the member actually commutes daily, at any distance.
  - Dependents are also "near" if they are within reasonable commuting distance, normally **50 miles one way** ("not inflexible").
  - Under 50 miles may still count as not near if the one-way commute exceeds **1.5 hours**, unless the member actually commutes.
  - If concurrent travel was authorized and the dependents chose to live more than 50 miles away for personal reasons, no FSA accrues.
  - Questionable cases go to CMC (RFF) [FMR 3.3.4.4].

## B. FSA types

### FSA-R (Restricted)

- **Conditions** [FMR 2.3.1.1]:
  - (1) Dependents, including those acquired after the PCS effective date, do not live in the vicinity of the homeport/PDS, **and** their transportation to or near the PDS is not authorized at government expense.
  - (2) **Or** transportation is authorized, but the member elects an unaccompanied tour **because a dependent cannot accompany due to certified medical reasons**.
- **CONUS PCS:** FSA is allowed only when dependent movement to the new PDS is not authorized at government expense [FMR 4.1.1.1]. The certified-medical exception is at 4.1.1.2. Permissive PCS gives no entitlement [4.1.1.3].
- **Electing unaccompanied when accompanied is authorized:** **Not entitled to FSA-R**, including tour extensions, except by Secretary of the Military Department waiver for "unusual family or operational circumstances" [FMR 4.1.3.1; Table 27-2 rule 2 and note 3; 4.1.4]. The certified-medical case is the separate exception above.
- **Waivers:** Authority sits with Service Secretaries or HQ designees, and with Combatant Commands / Service major commands. A waiver is effective on the date granted [4.1.4.1–4.1.4.3].
- **Overseas rules** [Table 27-2, rules 1–14]:
  - Restricted tour: entitled for the whole tour (rule 1).
  - Concurrent travel approved but dependents delayed for government reasons: entitled (rule 4). It stops the day before the dependents arrive (rule 5).
  - Advance-application area with a delay over 60 days: capped at 60 days unless the government caused the delay (rule 8).
  - Government-reasons delays include: lack of transportation, CONUS commander disapproval, health disapproval such as pregnancy, and insufficient retainability (notes 4–6).
- **Immigration:** No FSA-R if a dependent is authorized government transportation but is ineligible to enter the U.S. before the member reports [FMR 4.1.8].
- **Start date** [Table 27-1 rules 1–2]:
  - Credit starts on the **date of detachment from the old station** if no leave en route or proceed time.
  - Otherwise it starts on the **constructive date of detachment**: actual detachment plus leave and proceed days, or the first day of authorized travel, whichever is later.
  - Members are **not entitled to FSA-R or FSA-T during authorized leave en route or proceed time** [Table 27-4 note 4].
  - Dependents acquired after the PCS effective date: see Table 27-1 rules 5–15.
- **Stop date** [Table 27-3]:
  - Day before dependents arrive to establish residence (rule 1).
  - Day before arrival at a new non-qualifying station, using a constructive date if leave or proceed time is used (rule 2).
  - Day before entering a non-pay status (rule 4).
  - Sole dependent institutionalized: day before 1 year from entry (rule 5).
  - Secondary dependents only, who move in with relatives or friends: day before the move (rule 8).
- **Continuations** [Table 27-4 rules 1–6]:
  - FSA-R continues during TDY, hospitalization, confinement, and leave, at or away from the PDS, while the PDS is unchanged.
  - Leave at the dependents' residence followed by TDY within commuting distance of them: FSA-R is **suspended during that TDY** (rule 5).
  - A PDS change requires a new determination (rule 6, note 2).
- **Dependent visits:** Credit continues while dependents visit at or near the PDS for **up to 3 continuous months** [FMR 3.2.1]:
  - Visit intended to exceed 3 months: stop credit the day before the dependents arrive.
  - Visit unexpectedly extended by illness or emergency: stop at the end of 3 months.
  - Credit resumes the day the dependents depart.
  - Partial visit (some dependents stay longer): FSA continues on behalf of the dependents who are not visiting.

### FSA-S (Ship)

- **Conditions** [FMR 2.3.1.2]: The member is on duty aboard a ship and either:
  - The ship is away from homeport continuously for **more than 30 days**, or
  - The member is under orders to remain aboard while at homeport for more than 30 continuous days. This does not apply when kept aboard for disciplinary reasons.
- Dependents need not reside in the homeport vicinity (NOTE to 2.3.1.2).
- **Counting** [FMR 4.4.3]:
  - Count actual calendar days, **including the 31st of the month**, the day of departure from homeport (or the day of joining the ship away from homeport), and the day of return.
  - Leave, TAD, hospitalization, confinement, or short visits to homeport by the member do not interrupt the period unless the member is detached PCS.
  - Consecutive ships away from homeport may be combined.
- **Worked examples** [FMR 4.4.3 Ex. 1–6]:
  - Ex. 1: Depart 15 Jun, return 15 Jul = 31 actual days, so it qualifies. Payment is for 30 days (16 + 14), excluding the 31st and the return day.
  - Ex. 3: 25 Feb–26 Mar (non-leap year) = 30 days, so it does **not** qualify.
- **Start:** The date of departure [Table 27-1 rule 3], or the first day the member boards a ship away from homeport [rule 4]. Pay only after more than 30 continuous days [Table 27-1 note 1].
  - INFERENCE: Credit then runs retroactively from day 1, as Ex. 1 shows. It does not start on day 31.
- **Stop:** The day before the ship returns to homeport, or the date of detachment, whichever is earlier [Table 27-3 rule 6].
  - Same-day detach/attach to another ship away from homeport continues FSA-S (note 6).
  - Table 27-4 rules 13–19 cover TAD, hospitalization, leave and confinement while assigned to a ship away from homeport.
  - **Note 6:** If the dependents' residence is within commuting distance of where the member is in such a status, FSA-S continues 30 days only.
- **Ship moves near home** [FMR 4.5]:
  - Ship moves to a port within 50 miles / 1.5 hours of homeport: no FSA-S for members whose dependents are not near homeport.
  - Ship sits more than 30 days at a non-homeport where the member's dependents live, and the member lives with them: FSA-S is precluded [4.5.2].
  - Homeport change: Table 27-1 rule 17 and Table 27-3 rule 7.
- **Dependent visits:** Up to **30 days** at or near the duty station or any port [FMR 3.2.2]. If the visit exceeds 30 days, FSA-S **ends on the day preceding dependent arrival**. An illness or emergency extension is limited to 30 days of payment.
- **Marines embarked (ARG/MEU):** The FMR has no Marine- or embarked-unit-specific paragraph. FSA-S turns on being "on duty aboard a ship" [2.3.1.2].
  - INFERENCE: Embarked Marines on a ship away from homeport would be paid FSA-S, or FSA-T if on TAD orders, under one type at a time [2.1].
  - Note that **TDY/TAD periods and ship periods may not be combined to meet the 30-day test** [FMR 4.4.5.1].
  - Table 27-4 rule 13: a member already entitled to FSA-S who goes TAD keeps FSA-S.
  - I found **no MARADMIN or Navy guidance specific to embarked Marines**. OPEN QUESTION.

### FSA-T (Temporary)

- **Conditions** [FMR 2.3.1.3]:
  - TDY/TAD away from the PDS **or homeport** continuously for **more than 30 days**.
  - The dependents do not reside at or near the TDY station.
  - This includes TDY performed before reporting to the initial station.
  - Unaccompanied-tour members get FSA-T only if the dependents are not near the TDY station **and** not near the PDS.
  - If the member can commute or actually commutes daily, the dependents count as "at or near" (2.3.1.3 NOTE).
- **A unit ordered on exercise for more than 30 days** qualifies [FMR 4.2].
- **Counting** [FMR 4.4.1]:
  - Count actual days **including the departure day and the return day** (inclusive), **including the 31st** [4.4.1.1].
  - **Include authorized travel time** to and from the TDY station [4.4.1.2].
  - With leave en route, use **constructive** departure and return dates [4.4.1.2.1–4.4.1.2.2]. Departure = detachment + leave/proceed/permissive days, or the first day of authorized travel, whichever is later. Return = actual return − leave − permissive days.
  - POC travel for the member's convenience: compute on the actual mode [4.4.1.4].
  - TDY in conjunction with PCS: count travel to the TDY station and on to the new station. Consecutive TDYs en route may combine [4.4.1.3].
  - **Interruption:** Do not combine days before and after an interruption [4.4.1.5]:
    - Leave, hospitalization, confinement in a pay status, or short PDS visits do **not** interrupt unless the member is relieved from TDY attachment.
    - Returning to the PDS to assume a duty status **does** interrupt.
  - **Worked example** [4.4.1 Ex. 1]: Constructive departure 30 May, return 30 Jun = 32 days, so it qualifies. FSA-T is paid for 30 days, with no entitlement for 31 May (the 31st) or 30 Jun (the return day).
- **Start:** Credit starts on the **date of detachment** or the constructive detachment date [Table 27-1 rules 1–2]. It is **not paid until** more than 30 continuous days are completed [note 1].
  - INFERENCE, strongly supported by 4.4.1 Ex. 1 and 4.3 Example: Once qualified, credit is retroactive to day 1. It is not "day 31".
  - **Conflict:** A search snippet of semper-admin-portal.app.cloud.gov says "for FSA-S and FSA-T, FSA commences on the 31st day". That contradicts the FMR. The 31st-day rule in the FMR applies only to **evacuations** [FMR 4.1.7; Table 27-1 rule 16].
- **Stop:** The day before return from TDY, using a constructive date if leave was taken [Table 27-3 rule 3, note 3]. TDY with PCS: the day before arrival at the new station [rule 9].
- **Dependent visits:** Up to **30 days** [FMR 3.2.3].
  - Over 30 days: "not entitled to FSA-T for any part of the period", unless extended by illness or emergency, in which case payment is limited to 30 days.
  - Entitlement resumes on the day the dependents depart, **if** more than 30 days of TDY remain.
  - See ambiguity H5.
- **Hospital as a patient in attached status:** Not entitled [Table 27-4 rule 9].
- **Missing status:** FSA-T continues [FMR 4.3]. Example: Departed 9 Aug, missing from 2 Sep; entitled 9 Aug–9 Nov.
- **Line 8g "last TDY within 30 days" — the combining rule** [FMR 4.4.2; Table 27-4 rule 20]:
  - Applies when a prior TDY **qualified** (more than 30 days), the **interim** period at the PDS is **30 days or less**, and the **redeployment** is more than 30 days.
  - Then FSA-T continues for the interim **plus** the redeployment.
  - **Ex. 1:** 45-day TDY, 30-day interim, then 35 days. Paid for 65 more days, including the interim.
  - **Ex. 2:** Interim of 31 days. No interim pay; the 40-day redeployment is paid by itself.
  - **Ex. 3:** Interim of 0 days. Continues.
  - The ship equivalent is 4.4.4 / Table 27-4 rule 21.
  - **Restriction** [4.4.5]:
    - TDY and ship periods may not be combined.
    - Hospitalization or TDY over 30 days at a place where the member resides with dependents may not be counted.

## C. Disqualifiers and exceptions

| Situation | Rule | Citation |
|---|---|---|
| Divorced or legally separated | A member whose sole dependent is a legally separated spouse is not a "member with dependents". | FMR 3.1.2; FORM 8a |
| Child in custody of another | Not a dependent for FSA unless the member has joint physical and legal custody with the child resident at least 14 days a month. Fewer than 14 days per the decree: not a dependent. | FMR 2.2.1.1, 3.1.2, 3.1.3; FORM 8b |
| Dependent on active duty | Not a "member with dependents" if a dependent is entitled to active-duty basic pay. Member-married-to-member is still entitled. | FMR 3.1.5; FORM 8c, 8f |
| Sole dependent institutionalized | Not entitled if the stay is known or expected to exceed 1 year. If initially expected to be 1 year or less and it continues, stop the day before 1 year. | FMR 3.1.1; Table 27-3 rule 5 and note 5; FORM 8d |
| Dependents at or near duty station | No FSA if all dependents are at or near (50 mi / 1.5 hr / actual commute). Partial: FSA on behalf of the others. | FMR 3.3 |
| Elected unaccompanied tour where accompanied is authorized | No FSA-R, except certified-medical reasons (2.3.1.1.2, 4.1.1.2) or Secretarial waiver (4.1.3.1, 4.1.4). | FMR; 37 USC 427(c) [WS] |
| Permissive orders | No FSA. | FMR 1.1, 4.1.1.3 |
| Government quarters | **The FMR chapter does not make government quarters a disqualifier.** FORM block 14 asks the certifying officer to confirm the member draws BAH at the with-dependents rate, or lives in government quarters, "as a member with dependents or member married to a military member". INFERENCE: Block 14 is a dependency-status check, not a bar. | FORM 14 |
| Leave | FSA-R continues during leave (Table 27-4 rule 4). It is suspended during TDY near the dependents after leave at their home (rule 5). FSA-S continues during leave (rule 15), but only 30 days if the dependents are within commuting distance (note 6). For FSA-T, leave does not interrupt (4.4.1.5). **No FSA-R or FSA-T during leave en route or proceed time** (note 4). | FMR Table 27-4 |
| Non-pay status | Stop the day before. | Table 27-3 rule 4 |
| Evacuation | Authorized or ordered evacuation qualifies. Ordered evacuation pays from the 31st day. An approved authorized evacuation pays retroactively. Not paid when the evacuation is due to misconduct. | FMR 4.1.7; Table 27-1 rule 16; Table 27-3 rule 10 |
| Combat zone / hostile fire | **The FMR chapter has no combat-zone provision.** Only the missing-status rule (4.3) mentions hostile fire. INFERENCE: FSA is independent of HFP/IDP/CZTE, and eligibility is decided only by the R, S or T test. The source is silent here. | FMR 4.3 |
| Two FSAs | Never more than one FSA type for the same period. | FMR 2.1 |
| Both dual-military members | One per couple if no other dependents. Each member may be paid if the couple has dependents and resided together with them. | FMR 2.3.4.1.1, 2.3.4.2; Table 27-4 rules 22–24 |
| Parents (line 8e) | A dependent parent who does not reside in the home the member controls, supervises and maintains for mutual use does not make the member a "member with dependents". | FMR 3.1.4 |
| Secondary dependents with relatives or friends | Stop when the dependents move in with them. | FMR 2.2.4; Table 27-3 rule 8 |

- **Parents and dependency approval.** The FMR does not name the dependency-approval form or process. INFERENCE (not verified): Marine Corps parent dependency uses DD Form 137-3, approved under DoDI 1341.? / MCO 1751.3 by DFAS-IN Dependency. **MCO 1751.3 could not be fetched.** OPEN QUESTION.

## D. Rates and payment

- **Rate:** $300/month on or after 18 Dec 2025, and $250/month before [MARADMIN 150/26, WS; FMR 2.3.2 is stale].
  - The Army benefits site says "effective January 1, 2026" [WS: https://myarmybenefits.us.army.mil/Benefit-Library/Federal-Benefits/Family-Separation-Allowance-(FSA)-]. That **conflicts** with the MARADMIN; see H1.
- **Proration:**
  - FSA is paid on a **30-day month** basis: exclude the 31st day; treat February as 30 days [Table 27-1 note 1; FMR 4.4.1.1, 4.4.2.1, 4.4.4.1].
  - The FMR examples use $250/30 per day: $241.83 for 29 days, $291.67 for 35 days, $283.33 for 34 days [FMR 4.4.3 Ex. 2, 4, 5].
  - The FMR caps at one month per month. The examples show $250 for 31 actual days.
  - At $300 the per-day rate is $10.00. DFAS reportedly says "pro-rated to $10.00 per day" [WS, dfas.mil not fetched].
  - INFERENCE: For a period spanning 18 Dec 2025, split the period at that date: $8.33/day before and $10/day on and after.
- **Qualification counting vs. payment counting:** The 30-day test counts actual days including the 31st. Payment excludes it [FMR 4.4.1.1].
- **Dual-military payee:** See A [FMR 2.3.4].
- **How it is paid in MCTFS** [WS]:
  - MARADMIN 150/26 says MCTFS was updated automatically for the new rate.
  - FSA is reported via unit diary by the IPAC / admin section [WS: a UDP reference says "MCO P1080.40 contains unit diary reporting requirements for the FSA-Type II allowance"].
  - **I could not find the actual TTCs** (start/stop for FSA-R, FSA-S, FSA-T) in any accessible source. A related MARADMIN snippet gives **TTC 388/002 for Family Separation Housing-B (FSH-B)**. That is **a different allowance, not FSA**. OPEN QUESTION: the MCTFS PRIUM (MCO P1080.40 series) or Codes Manual (MCO P1080.20) is needed.

## E. Evidence, certification and retention

- The member completes Part I (blocks 1–9). The **certifying officer** completes Part II (blocks 10–16) [FORM, Part headings].
- Evidence implied by the form and the FMR (INFERENCE from what each block certifies):
  - **Orders** (block 13 authority and date): TDY orders for FSA-T, PCS orders for FSA-R, ship assignment or orders for FSA-S.
  - **Leave and proceed dates** for constructive-date computation [FMR 4.4.1.2; Table 27-1 rule 2].
  - For FSA-R: proof that dependent transportation is not authorized (restricted area or unaccompanied orders), or a certified-medical determination or Secretarial waiver.
  - For custody: court order, divorce decree, or notarized custody affidavit [FMR 2.2.1.1].
  - For parents: an approved, current dependency determination [FORM 8e; FMR 3.1.4].
  - For dual-military: the spouse's ID, branch and component, and whether they were residing together [FORM 8f; FMR 2.3.4.1].
  - Block 14: BAH-with-dependents status or government-quarters status from MCTFS.
- **Who may certify:** **No Marine Corps source found.**
  - Navy guidance [WS: MyNavy HR FSA training, https://www.mynavyhr.navy.mil/Portals/55/Support/PayPers/CPCResources/FSA_Nov2024.pdf] says the CO, or a personnel officer with "By Direction" authority, signs Part II. Navy also notes that a DD 577 is not needed if the CO signs.
  - INFERENCE: In the Marine Corps this is likely the CO or IPAC certifying officer with By Direction authority. Unverified. OPEN QUESTION.
- **Retention:** The FORM Privacy Act statement says it "Serves as substantiating document for FSA payments and input into the member's pay account", "Provides an audit trail", and "Provides a record in service member's pay account".
  - **No Marine Corps retention period was found.** OPEN QUESTION: MCO 5210.11 records schedule / IRAM.
- **Duty to notify:** The member must notify the CO immediately on any change in dependency status, if dependents move to or near the station, or if visits exceed the limits [FORM block 9].

## F. Block-by-block, DD 1561 NOV 2006 (the uploaded form)

All date fields print **"(DDMMYY)"** on the form: blocks 7, 9a, 11, 12 and 15. Block 10b is "From/To" with no format printed. **Caution:** DDMMYY is a nonstandard order. INFERENCE: Render exactly six digits, day-month-year, e.g. 241126.

| Block | Filled by | Meaning / policy-implied validation |
|---|---|---|
| 1 Name (Last, First, MI) | Member | — |
| 2 Grade | Member | Any grade qualifies [FMR 2.3.1]. |
| 3 SSN | Member | The 2006 form asks for SSN. The DEC 2017 edition reportedly uses **DoD ID** [WS]. See G. |
| 4 Branch and Organization | Member | — |
| 5 "TYPE II" — FSA-T / FSA-R / FSA-S | Member | Exactly **one** type [FMR 2.1]. The AcroForm `xtype` radio group (T/R/S) fits this. "Type II" is legacy naming; it distinguished this allowance from the old FSA Type I, which was abolished. INFERENCE: The form has three boxes, **not five**. |
| 6 Current address(es) of dependent(s) | Member | Needed to test "at or near" the PDS, TDY station or homeport (50 mi / 1.5 hr) [FMR 3.3]. Multiple addresses are allowed (partial-dependent rules). |
| 7 Date departed residence to unit home station (Mobilized Members) | Member (RC only) | Supports the RC "PDS = place ordered to AD / place of entry to AD" rule [FMR 2.3.1.3 NOTE]. Leave blank for active component (INFERENCE). |
| 8a Not divorced or legally separated | Member | Required if claiming on the basis of a spouse [FMR 3.1.2]. |
| 8b Child not in legal custody of another when orders received | Member | Must be true, or joint custody with at least 14 days/month must be documented [FMR 2.2.1.1, 3.1.2–3.1.3]. |
| 8c Dependent (other than spouse) not on active duty | Member | [FMR 3.1.5] |
| 8d Sole dependent not institutionalized for more than 1 year | Member | [FMR 3.1.1] |
| 8e Claiming FSA for parent(s) with current approved dependency, member maintains residence | Member | Check only when the claim rests on a parent. Requires approved dependency and a residence the member maintains for mutual use [FMR 3.1.4]. Note the form wording "am residing with, and I maintain a residence(s)" — see H6. |
| 8f Married to active-duty member; spouse **was / was not** residing with me immediately before separation; Spouse's SSN; Branch and Component | Member | "Was" is **required** for dual-military entitlement [FMR 2.3.4.1]. If "was not" and there are no other dependents, there is no FSA (INFERENCE from 2.3.4.1). Spouse SSN, branch and component are needed to prevent a duplicate per-couple payment [2.3.4.1.1]. Radio group `xspouse`. |
| 8g Last TDY or deployment **was / was not** within the last 30 days from this TDY or deployment | Member | Drives the interim/redeployment continuation rule [FMR 4.4.2, 4.4.4; Table 27-4 rules 20–21]. If "was", the certifying officer needs the prior qualifying period and interim length; continuation applies only if the prior period qualified (more than 30 days) and the interim was 30 days or less. TDY and ship periods cannot be combined [4.4.5.1]. Radio group `xtdy`. |
| 9 Acknowledgment; 9a Date (DDMMYY); 9b Signature | Member | Text says visits over **90 continuous days** (FSA-R) or **over 30** (FSA-T and FSA-S) must be reported. The FMR says "3 continuous months" for FSA-R (H2). The AcroForm signature `mbr_sign` is plain text. INFERENCE: Leave it for wet or CAC signature rather than auto-filling a name. |
| 10 TYPE II FSA-T table: a Location, b Inclusive dates (From/To), c No. of days | Certifying officer | Days = inclusive count, including the departure and return days and the 31st, including authorized travel, using constructive dates when leave is taken [FMR 4.4.1]. **Validation:** the total for the continuous period must be **more than 30** (31 or more). Each location must be outside 50 mi / 1.5 hr of the PDS (or HOR for RC) [FORM 10; FMR 3.3, 2.3.1.3]. The AcroForm has 3 rows; the form says "Attach a blank page for continuation". Consecutive TDYs combine only if continuous; an interruption resets the count [4.4.1.3, 4.4.1.5]. NO. OF DAYS is qualification days, **not** paid days. INFERENCE: The app should show paid days (30-day-month) separately and not write them in this block. |
| 11 TYPE II FSA-R: departed (PCS/detached) from [last PDS] on [DDMMYY]; leave en route [inclusive DDMMYY]; proceed time [inclusive]; reported to [PDS] on [DDMMYY]; "Transportation of dependent(s) is not authorized at government expense…" | Certifying officer | Gives the constructive detachment date, which is the FSA-R start [Table 27-1 rule 2]. Validation: detach ≤ leave start ≤ leave end ≤ report; proceed dates inside the travel window. No FSA-R for leave en route or proceed days [Table 27-4 note 4]. The certification of transportation not authorized does not fit the certified-medical exception (2.3.1.1.2), where transport *is* authorized. See H7. |
| 12 TYPE II FSA-S: serving on orders aboard ship away from homeport commencing [DDMMYY]; a Name of ship/unit; b Homeport | Certifying officer | The commencing date is the ship's departure date, or the date the member boarded away from homeport [Table 27-1 rules 3–4]. Payable only after more than 30 continuous days. "SHIP/UNIT" lets an embarked unit be named (INFERENCE). |
| 13 Travel performed under authority of orders ___, dated ___ | Certifying officer | Order number or authority and date. Applies to all types (INFERENCE). |
| 14 Member is receiving BAH (or residing in government quarters) as a member with dependents or member married to a military member | Certifying officer | Confirms dependency status in pay (INFERENCE). Not a quarters bar. |
| 15 Date (DDMMYY) | Certifying officer | Must be on or after 9a (INFERENCE). |
| 16a Typed name, b Title, c Organization, d Signature | Certifying officer | Signature `cert_sign` is a plain text field. Authority: see E (open). |

## G. Edition check

- **The NOV 2006 edition is NOT current.** [WS]
  - The DoD Forms Management site lists DD 1561 with **edition date 12/01/2017 (DEC 2017)**: https://www.esd.whs.mil/Directives/forms/dd1500_1999/DD1561/
  - The PDF (https://www.esd.whs.mil/Portals/54/Documents/DD/forms/dd/dd1561.pdf) is reportedly marked "DD FORM 1561, DEC 2017 … PREVIOUS EDITION IS OBSOLETE", with an "Updated 20241204" note.
- Navy pay guidance says to use "DEC 2017 Edition (NOT 2006)" [WS: MyNavy HR FSA_Nov2024.pdf].
- **MCB Butler IPAC** posts a DEC 2017 template: https://www.mcbbutler.marines.mil/Portals/189/Docs/IPAC/IPAC_Inbound/FSA%20Form%20Template.pdf [WS].
- The DFAS-hosted dd1561.pdf is still the 2006 edition.
- Reported differences [WS, low confidence; not read]:
  - Block 3 is DoD ID instead of SSN.
  - An updated Privacy Act statement.
  - Certifying-officer block numbering may differ.
  - The FSA-T / FSA-R / FSA-S sections seem to remain in blocks 10–12.
- **Not verified:** I could not open the DEC 2017 PDF. Someone should download it from esd.whs.mil and diff the AcroForm before the field mapping is built.

## H. Ambiguities and conflicts (flagged, not resolved)

1. **Effective date of $300.** MARADMIN 150/26 says **18 Dec 2025**. The Army benefits site says **1 Jan 2026** [WS]. FMR 2.3.2 still says $250. For Marines, the MARADMIN governs; note it is an unverified [WS] reading.
2. **Visit limit for FSA-R.** FORM block 9 says "more than **90** continuous days". FMR 3.2.1 says "**3 continuous months**". These differ by up to 2 days depending on the months.
3. **Dual-military wording.** FMR 2.3.4.1.1 says "not more than one monthly FSA … with respect to a **married military couple**". Table 27-4 note 8 says "with respect to **each member** of a married military couple". Reconciliation (INFERENCE): the per-couple cap applies to couples without other dependents; the per-member rule applies to couples with dependents (2.3.4.2 / rule 24). A search summary also flagged the per-couple vs per-member tension.
4. **Start date "day 31".** A search snippet of semper-admin-portal.app.cloud.gov, which looks like this project's own content, says FSA-S/T "commences on the 31st day". The FMR says credit starts on the departure or detachment date, payable once more than 30 days is met [Table 27-1 rules 1–4, note 1; 4.4.1 Ex. 1; 4.4.3 Ex. 1]. The 31st-day start applies only to evacuations [4.1.7; Table 27-1 rule 16]. **Recommend correcting the portal content.**
5. **FSA-T visit over 30 days.** "Not entitled to FSA-T for any part of the period" [FMR 3.2.3]. It is unclear whether "the period" means the visit period or the whole TDY. The next sentence (resumes when the dependents depart if more than 30 days of TDY remain) suggests the visit period plus a re-qualification test. FSA-S instead ends on the day preceding arrival [3.2.2]. The rules are asymmetric.
6. **Line 8e wording.** The form says "am residing with, and I maintain a residence(s)". FMR 3.1.4 requires the parent to reside in a home the member maintains for mutual use. These are close but not identical.
7. **Block 11 vs certified-medical FSA-R.** Block 11's printed certification (transportation not authorized) does not fit 2.3.1.1.2, where transport is authorized but the member elects unaccompanied for certified medical reasons. How Marine IPACs document this case is unknown.
8. **FMR 2.3.1.3 TDY "away from their PDS or homeport".** The FMR now explicitly includes homeport for FSA-T (October 2025 change, "Clarified Family Separation type T"). The form block 10 text references only PDS/HOR.
9. **Form block 5 "Type II".** The caller described "5 Type II boxes". The NOV 2006 form has three type boxes (T/R/S), matching the `xtype` radio group.
10. **DoD Instruction 1340.24.** The FMR cites DoDI 1340.24 of 15 Jun 2023. A search summary of the ESD "recent publications" page lists a "DoWI 1340.24, Family Separation Allowance" dated **10/5/2026** [WS]. Unverified, and its content is unknown. It may change rules or confirm $300.
11. **Statutory section numbering** (427(b), (c), (d)) is from search excerpts. The FMR's reference list cites 427(b) for the amount (2.3.2) and 427(d) for member married to member (2.3.4). Verify against uscode.house.gov.

## Open questions (need a primary source)

1. Marine Corps MCTFS unit-diary TTCs to start, stop and change FSA-R, FSA-S and FSA-T, and the unit-diary deadline. Source: MCTFS PRIUM (MCO P1080.40 series) / Codes Manual (MCO P1080.20). Not accessible.
2. Who may sign Part II in the Marine Corps (CO, By Direction, IPAC certifying officer?), and the DD 1561 retention and filing location (OMPF/ESR? IPAC files? how long?).
3. Exact DEC 2017 DD 1561 layout and AcroForm fields (DoD ID vs SSN; block numbering of the certifying section). Download from esd.whs.mil.
4. Marine-specific guidance on FSA-S vs FSA-T for Marines embarked on ARG/MEU shipping, including how TAD-to-ship orders are treated.
5. Full text of MARADMIN 150/26 and the 23 Dec 2025 OASW memo: confirm 18 Dec 2025 and whether units must take any retroactive action.
6. MCO 1751.3 parent dependency (DD 137-3) process and how "current and approved" is verified for 8e.
7. Whether DoWI 1340.24 (reported 5 Oct 2026) changes any rule.
8. Current statutory text of 37 USC 427 (all subsections), verified on uscode.house.gov.

---

## P. Proposed app design (for owner review)

### P1. Form technology
- The NOV 2006 DD 1561 is an AcroForm: 1 page, 46 fields (35 text, 7 checkboxes, 3 radio groups `xtype` T/R/S,
  `xspouse` Yes/No, `xtdy` Yes/No, 1 reset button). It is owner-password encrypted with an EMPTY user password,
  so it opens without a password; pdf-lib cannot write it until a decrypted copy is shipped (tools/ script,
  same as the other blanks in public/forms). Field names are readable after decryption: `mbr_name`, `mbr_grade`,
  `mbr_ssn`, `mbr_org`, `xtype`, `dep_addr`, `depart`, `x8a`..`x8g`, `xspouse`, `spouse_ssn`, `spouse_branch`,
  `xtdy`, `mbrsign_date`, `mbr_sign`, `fsat_loc1..3`, `fsat_dates1..3`, `fsat_days1..3`, `fsar_stn`,
  `fsardep_date`, `fsarleave_dates`, `fsar_proceed`, `fsar_pds`, `fsarrpt_date`, `fsascomm_date`, `ship_name`,
  `homeport`, `orders`, `orders_dated`, `cert_date`, `cert_name`, `cert_title`, `cert_org`, `cert_sign`.
- Signatures (`mbr_sign`, `cert_sign`) are plain text fields, not signature widgets.
- Rendering follows the UPB / COLA pattern: fill the official AcroForm, preview it in-app, export it unflattened.
- BLOCKER: the NOV 2006 edition is reportedly obsolete (section G). The field map must be rebuilt from the
  DEC 2017 blank before build.

### P2. Guided flow (member-facing questions, then the form)
1. Eligibility screen: dependents? (spouse / child / parent with approved dependency), dual-military?, active or
   mobilized reserve? Hard-stop with the cited reason when a disqualifier applies (section C).
2. Type selection by situation, not by code: "PCS where dependents can't come" -> FSA-R; "aboard ship away from
   homeport" -> FSA-S; "TDY/TAD over 30 days" -> FSA-T. One type per period (FMR 2.1).
3. Type-specific dates with a live day counter implementing FMR 4.4.1 (inclusive count, constructive dates for
   leave/proceed, 31st day counted) and the 8g interim/redeployment rule (4.4.2). Shows "qualifies: N days > 30".
4. Certifications 8a-8g as plain-language yes/no questions mapped to the boxes; 8f/8g reveal their follow-ups.
5. Part II (certifying officer) prefilled from the orders data the clerk already entered; certifying officer
   name, title, organization collected like the 10922 attesting official.
6. Output: filled DD 1561 (unflattened), dates in the form's DDMMYY order.

### P3. Validation the app can enforce
- FSA-T and FSA-S: continuous period must exceed 30 days; TDY and ship periods never combined (4.4.5.1).
- FSA-T: 3 table rows; overflow needs a continuation page (form block 10 says attach a blank page).
- FSA-R: detach <= leave <= report ordering; no FSA-R for leave en route or proceed days.
- Dual-military: 8f "was" required; spouse branch/component required.
- 15 (certified date) on or after 9a (member date).
- Dependent visits: block 9 acknowledgment shown in plain language (FSA-R 90 days per form / 3 months per FMR;
  FSA-S and FSA-T 30 days).

### P4. Decisions needed from the owner
1. Obtain the DEC 2017 DD 1561 blank (esd.whs.mil, blocked in this environment) and confirm it replaces NOV 2006.
2. SSN handling: NOV 2006 asks for member and spouse SSN; DEC 2017 reportedly uses DoD ID. Collect only what the
   current edition prints.
3. Show an estimated FSA amount ($300/month, $10/day per MARADMIN 150/26 [WS]) or only eligibility and day counts?
4. Who signs Part II in the Marine Corps (CO, By Direction, IPAC certifying officer) and whether the app prefills it.
5. Allow the network hosts in section 0 so the [WS] facts can be verified from primary pages.
6. Correct the "commences on the 31st day" statement found on semper-admin-portal.app.cloud.gov (H4).
