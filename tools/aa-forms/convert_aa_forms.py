#!/usr/bin/env python3
"""B1/B2/B3 (docs/AA_FORMS_TEMPLATE_PLAN.md): convert the extracted XFA
data into .nldp template files + index entries. Stages into /tmp/nldp_out
for inspection; a separate copy step moves them into the repo."""
import json, re, os, sys

SRC = '/tmp/forms/all_datasets.json'
OUT = '/tmp/nldp_out'
os.makedirs(OUT, exist_ok=True)
data = json.load(open(SRC))

NOTE_RE = re.compile(r'\(\s*Note:.*?\)', re.S | re.I)

# file -> (id, title, description). Subjects stay source-authoritative.
META = {
 'AA FORM; 3 POV Template.pdf': ('aa-3-pov', 'AA Form - Third POV Authorization',
  'Request authorization of a third privately owned vehicle. Routes to CMC (MMIB-3).'),
 'AA FORM; Alternate Separation Site Template.pdf': ('aa-alt-separation-site', 'AA Form - Alternate Separation Site',
  'Request separation at a site other than the normal processing location. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH AFMT Template.pdf': ('aa-bah-afmt', 'AA Form - BAH Advanced Family Member Travel',
  'Request BAH in conjunction with advanced family member travel. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH Change Designated Place Template.pdf': ('aa-bah-designated-place', 'AA Form - BAH Change of Designated Place',
  'Request BAH for relocation of dependents to a designated place. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH DDT Extension Template.pdf': ('aa-bah-ddt-extension', 'AA Form - BAH DDT Waiver Extension',
  'Request extension of an existing BAH waiver for delayed dependent travel. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH DDT Template.pdf': ('aa-bah-ddt', 'AA Form - BAH Delay of Dependent Travel',
  'Request a BAH waiver in conjunction with delayed dependent travel. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH Deployment Template.pdf': ('aa-bah-deployment', 'AA Form - BAH DDT (Deployment)',
  'Request BAH with delayed dependent travel due to an upcoming deployment. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH PME_Training Template.pdf': ('aa-bah-pme', 'AA Form - BAH PME/Training Waiver',
  'Request a BAH PME waiver for school or training moves. Routes to CMC (MMIB-3).'),
 'AA FORM; BAH Proximity Retention Template.pdf': ('aa-bah-proximity-retention', 'AA Form - BAH Retention (Low-Cost PCS)',
  'Request BAH retention for a low-cost or proximity PCS move. Routes to CMC (MMIB-3).'),
 'AA FORM; COT Incentive Template.pdf': ('aa-cot-incentive', 'AA Form - COT Incentive',
  'Request to execute the Consecutive Overseas Tour incentive. Routes to CMC (MMIB-3).'),
 'AA FORM; Circuitous Travel Template.pdf': ('aa-circuitous-travel', 'AA Form - Circuitous Travel',
  'Request circuitous travel in conjunction with PCS. Routes to CMC (MMIB-3).'),
 'AA FORM; ERD Template.pdf': ('aa-erd', 'AA Form - Early Return of Dependents',
  'Request early return of dependents from an overseas station. Routes to CMC (MMIB-3).'),
 'AA FORM; Excess Baggage Template.pdf': ('aa-excess-baggage', 'AA Form - Excess Baggage Reimbursement',
  'Request reimbursement of excess baggage expenses in conjunction with PCS. Routes to CMC (MMIB-3).'),
 'AA FORM; Fully Funded PCSO Template.pdf': ('aa-fully-funded-pcso', 'AA Form - PCA/LCPCS to Fully Funded PCSO',
  'Request conversion of PCA/low-cost PCS orders to fully funded PCS orders. Routes to CMC (MMIB-3).'),
 'AA FORM; IPCOT Incentive Template.pdf': ('aa-ipcot-incentive', 'AA Form - IPCOT Incentive',
  'Request to execute the In-Place Consecutive Overseas Tour incentive. Routes to CMC (MMIB-3).'),
 'AA FORM; OTEIP Change Template.pdf': ('aa-oteip-change', 'AA Form - OTEIP Incentive Change',
  'Request a change to an elected Overseas Tour Extension Incentive. Routes to CMC (MMIB-3).'),
 'AA FORM; OTEIP Incentive Template.pdf': ('aa-oteip-incentive', 'AA Form - OTEIP Incentive Funding',
  'Request Overseas Tour Extension Incentive Program funding. Routes to CMC (MMIB-3).'),
 'AA FORM; TAD Excess of 180 Days Template.pdf': ('aa-tad-180', 'AA Form - TAD in Excess of 180 Days',
  'Request authorization of TAD exceeding 180 days. Routes to CMC (MMIB-3).'),
 'AA-Form-O6-level-SgtMaj-slate.pdf': ('aa-sgtmaj-slate', 'AA Form - Reserve O6-Level SgtMaj Slate (Request)',
  'Request consideration for the Reserve O6-level Sergeant Major slate. Routes to CMC (MMOA).'),
 'AA-Form-not-to-be-O6-level-SgtMaj-slate.pdf': ('aa-sgtmaj-slate-decline', 'AA Form - Reserve O6-Level SgtMaj Slate (Decline)',
  'Request NOT to be considered for the Reserve O6-level Sergeant Major slate. Routes to CMC (MMOA).'),
 'AA-Form-RA-SgtMaj-Billet.pdf': ('aa-ra-sgtmaj-billet', 'AA Form - Reserve 1stSgt/SgtMaj Billet Acceptance',
  'Statement of intent to accept a Reserve First Sergeant or Sergeant Major billet. Routes to CMC (MMOA).'),
 'NAVMC-10274-AA-FORM-CONUS-12-Month-Extension-reviewed.pdf': ('aa-conus-extension', 'AA Form - CONUS 12-Month Extension',
  'Officer 12-month CONUS tour extension. Use maximum approved abbreviations (MCO P1070.12K sec 6002); Via lists endorsing units, not the destination. Routes to CMC (MMOA-1).'),
 'NAVMC-10274-AA-FORM-OCONUS-12-Month-Extension-reviewed.pdf': ('aa-oconus-extension', 'AA Form - OCONUS 12-Month Extension',
  'Officer 12-month overseas tour extension. Use maximum approved abbreviations (MCO P1070.12K sec 6002); Via lists endorsing units, not the destination. Routes to CMC (MMOA-1).'),
 'NAVMC-10274-AA-FORM-TOS-WAIVER-reviewed.pdf': ('aa-tos-waiver', 'AA Form - 12-Month TOS Waiver',
  'Officer time-on-station waiver. Use maximum approved abbreviations (MCO P1070.12K sec 6002); spell the unit address in full in Organization/Station. Routes to CMC (MMOA-1).'),
 'NAVMC-10274-AA-FORM-TOUR-CURTAILMENT-reviewed.pdf': ('aa-tour-curtailment', 'AA Form - 12-Month Tour Curtailment',
  'Officer overseas tour curtailment. Use maximum approved abbreviations (MCO P1070.12K sec 6002); Via lists endorsing units, not the destination. Routes to CMC (MMOA-1).'),
}

MMOA_FILES = {f for f in META if 'reviewed' in f}
PROFILE_FROM = 'Rank First MI. Last, EDIPI/MOS, USMC'

def strip_notes(s):
    return NOTE_RE.sub('', s or '').strip()

def lines_of(s):
    return [l.rstrip() for l in (s or '').split('\r')]

def split_list(s, prefix_re):
    """Split a CR-list; strip numbering prefixes; unprefixed lines are
    continuations of the previous item."""
    items = []
    for raw in lines_of(strip_notes(s)):
        line = raw.strip()
        if not line: continue
        m = re.match(prefix_re, line)
        if m:
            items.append(line[m.end():].strip())
        elif items:
            items[-1] = items[-1] + ' ' + line
        else:
            items.append(line)
    # MMOA teaching artifact: "X or NONE" tails glued to real items.
    items = [re.sub(r'\s+or\s+(NONE|NA|N/A)\.?\s*$', '', x, flags=re.I) for x in items]
    return [i for i in (x.strip() for x in items) if i]

def parse_paragraphs(s):
    """SuppInfo -> ParagraphData[]. Prefixes strip (renderer numbers);
    unprefixed lines continue the previous paragraph."""
    paras = []
    for raw in lines_of(strip_notes(s)):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped: continue
        m1 = re.match(r'^\d+\.\s*', stripped)
        m2 = re.match(r'^[a-z]\.\s+', stripped)
        m3 = re.match(r'^\(\d+\)\s*', stripped)
        m4 = re.match(r'^\([a-z]\)\s*', stripped)
        if m1: paras.append({'level': 1, 'content': stripped[m1.end():]})
        elif m2: paras.append({'level': 2, 'content': stripped[m2.end():]})
        elif m3: paras.append({'level': 3, 'content': stripped[m3.end():]})
        elif m4: paras.append({'level': 4, 'content': stripped[m4.end():]})
        elif paras: paras[-1]['content'] += ' ' + stripped
        else: paras.append({'level': 1, 'content': stripped})
    # drop stray signature-placeholder tails (e.g. "FI. MI. LNAME", "I. M. CAPTAIN")
    while paras and re.fullmatch(r'[A-Z][A-Za-z]{0,4}\.( ?[A-Z][A-Za-z]{0,4}\.)? ?[A-Z]{2,15}\.?', paras[-1]['content'].strip()):
        paras.pop()
    # clean doubled spaces
    for p in paras:
        p['content'] = re.sub(r'\s{2,}', ' ', p['content']).strip()
    # Naval ladder rule: a subdivision goes exactly one level deeper
    # than its parent, and siblings share a level. Sources jump
    # 1. -> (a); normalize with an ancestor stack so a run of (a)(b)(c)
    # under a 1. becomes a,b,c (level 2), not a staircase.
    stack = []  # (sourceLevel, normalizedLevel) ancestors
    for p in paras:
        src = p['level']
        while stack and stack[-1][0] > src:
            stack.pop()
        if stack and stack[-1][0] == src:
            p['level'] = stack[-1][1]  # sibling
        else:
            parent = stack[-1][1] if stack else 0
            p['level'] = parent + 1
            stack.append((src, p['level']))
    return [{'id': i + 1, 'level': p['level'], 'content': p['content']} for i, p in enumerate(paras)]

def multiline(s):
    return '\n'.join(l.strip() for l in lines_of(strip_notes(s)) if l.strip())

GENERIC_ORG = 'Unit Name\nAddress\nCity, State Zip'

index_entries = []
report = []
for fname, (tid, title, desc) in META.items():
    src = data[fname]
    subj = re.sub(r'\s{2,}', ' ', strip_notes(src.get('NatOfAct', '')).replace('\r', ' ')).strip()
    to = multiline(src.get('AddrTo', ''))
    org = multiline(src.get('OrgStat', ''))
    if fname in MMOA_FILES:
        # teaching copies: OrgStat holds an example with commentary - use the generic placeholder
        org = GENERIC_ORG
    if not org: org = GENERIC_ORG
    vias = split_list(src.get('Via1', ''), r'^\(\d+\)\s*')
    refs = split_list(src.get('RefAuth', ''), r'^\([a-z]\)\s*')
    # MMOA "or NONE" artifacts
    refs = [r for r in refs if not re.fullmatch(r'(or\s+)?(NONE|NA|N/A)[\s.]*', r, re.I)]
    encls = split_list(src.get('Encl1', ''), r'^\(\d+\)\s*')
    encls = [e for e in encls if not re.fullmatch(r'(or\s+)?(NONE|NA|N/A)[\s.]*', e, re.I)]
    if fname in MMOA_FILES:
        encls = [re.sub(r'^EX[.:]?\s*', '', e).strip() for e in encls]
        vias = ['CO, (endorsing unit)']
        copyTos = []
    else:
        copyTos = [l.strip() for l in lines_of(strip_notes(src.get('CopyTo', ''))) if l.strip()]
    paragraphs = parse_paragraphs(src.get('SuppInfo', ''))

    nldp = {
        'metadata': {
            'packageId': f'nldp_template_{tid}',
            'formatVersion': '1.0.0',
            'createdAt': '2026-07-17T00:00:00.000Z',
            'author': {'name': 'System Template', 'unit': 'HQMC'},
            'package': {'title': title, 'description': desc, 'subject': subj,
                        'documentType': 'aa-form', 'tags': ['template', 'aa-form']},
            'checksums': {'dataHash': '', 'crc32': ''},
        },
        'data': {
            'formData': {
                'documentType': 'aa-form',
                'actionNo': '',
                'orgStation': org,
                'from': PROFILE_FROM,
                'to': to,
                'subj': subj,
                'date': '',
                'sig': '',
                'ssic': (src.get('FileNum') or '').strip(),
                'originatorCode': '', 'line1': '', 'line2': '', 'line3': '',
                'endorsementLevel': '', 'basicLetterReference': '',
                'referenceWho': '', 'referenceType': '', 'referenceDate': '',
                'startingReferenceLevel': 'a', 'startingEnclosureNumber': '1',
                'startingPageNumber': 1, 'previousPackagePageCount': 0,
            },
            'vias': vias, 'references': refs, 'enclosures': encls,
            'copyTos': copyTos, 'paragraphs': paragraphs,
        },
    }
    out = f'{tid}.nldp'
    json.dump(nldp, open(os.path.join(OUT, out), 'w'), indent=2)
    index_entries.append({'id': tid, 'title': title, 'description': desc,
                          'documentType': 'aa-form', 'url': f'/templates/global/{out}'})
    report.append(f'{out}: subj="{subj[:50]}" refs={len(refs)} encls={len(encls)} vias={len(vias)} copyTos={len(copyTos)} paras={len(paragraphs)} levels={[p["level"] for p in paragraphs]}')

# B2: Page 11 Redesignation (Stephen's supplied text, verbatim)
REMARKS = ("____________: I have been counseled by my Commanding Officer this date that I must incur an "
 "additional 24-month Obligated Service (OBS) upon acceptance of redesignation to the rank of First "
 "Sergeant. Also, I understand that if selected for redesignation, I will not be eligible for promotion "
 "to Sergeant Major until I have served 2 years time in grade as a First Sergeant, and that I may "
 "receive permanent change of station orders requiring me to obligate additional service.\n\n\n"
 "________________________________________________________\n(Marines Signature)\n\n\n"
 "________________________________________________________\n(Commanding Officers Signature)")
pg11 = {
    'metadata': {
        'packageId': 'page11_redesignation_firstsgt',
        'formatVersion': '1.0.0',
        'createdAt': '2026-07-17T00:00:00.000Z',
        'author': {'name': 'System Template'},
        'package': {'title': 'Redesignation to First Sergeant',
                    'description': 'OBS counseling entry for redesignation to First Sergeant (24-month obligated service, SgtMaj promotion eligibility, PCS obligation).',
                    'documentType': 'page11'},
    },
    'data': {
        # Entries flow LEFT column first (2026-07-17 ruling) - the
        # NAVMC 118(11) two-column remarks fill left, overflow right.
        'formData': {'documentType': 'page11', 'name': '', 'edipi': '', 'date': '',
                     'remarksLeft': REMARKS, 'remarksRight': ''},
        'vias': [], 'references': [], 'enclosures': [], 'copyTos': [], 'paragraphs': [],
    },
}
json.dump(pg11, open(os.path.join(OUT, 'page11-redesignation-firstsgt.nldp'), 'w'), indent=2)
index_entries.append({'id': 'page11-redesignation-firstsgt', 'title': 'Page 11 - Redesignation to First Sergeant',
                      'description': 'OBS counseling entry for redesignation to First Sergeant.',
                      'documentType': 'page11', 'url': '/templates/global/page11-redesignation-firstsgt.nldp'})

json.dump(index_entries, open(os.path.join(OUT, '_new_index_entries.json'), 'w'), indent=2)
print('\n'.join(report))
print(f'\nwrote {len(index_entries)} entries -> {OUT}')
