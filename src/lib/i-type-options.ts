export const I_TYPE_OPTIONS = {
  shortTitleFormats: [
    { value: '', label: 'Select Short Title Format' },
    { value: 'LI-#####X-##/#', label: 'LI #####X-##/#' },
    { value: 'MI-#####X-##/#', label: 'MI #####X-##/#' },
    { value: 'SI-#####X-##/#', label: 'SI #####X-##/#' },
    { value: 'TI-#####X-##/#', label: 'TI #####X-##/#' },
    { value: 'SL-3-#####X', label: 'SL-3-#####X' },
    { value: 'SL-4-#####X', label: 'SL-4-#####X' },
    { value: 'TM-#####X-##/#', label: 'TM #####X-##/#' },
  ],

  publicationTypes: [
    { value: '', label: 'Select Publication Type' },
    { value: 'LUBRICATION INSTRUCTION', label: 'LUBRICATION INSTRUCTION' },
    { value: 'MODIFICATION INSTRUCTION', label: 'MODIFICATION INSTRUCTION' },
    { value: 'SUPPLY INSTRUCTION', label: 'SUPPLY INSTRUCTION' },
    { value: 'TECHNICAL INSTRUCTION', label: 'TECHNICAL INSTRUCTION' },
    { value: 'COMPONENTS STOCKLIST SL-3', label: 'COMPONENTS STOCKLIST SL-3' },
    { value: 'COMPONENTS STOCKLIST SL-4', label: 'COMPONENTS STOCKLIST SL-4' },
    { value: 'COMMERCIAL OFF-THE-SHELF', label: 'COMMERCIAL OFF-THE-SHELF' },
    { value: 'QUICK REFERENCE GUIDE', label: 'QUICK REFERENCE GUIDE' },
    { value: 'REPAIR PARTS & SPECIAL TOOLS LIST', label: 'REPAIR PARTS & SPECIAL TOOLS LIST' },
    { value: 'SUPPLEMENT', label: 'SUPPLEMENT' },
    { value: 'TECHNICAL MANUAL', label: 'TECHNICAL MANUAL' },
    { value: 'TECHNICAL MANUAL WITH RPSTL', label: 'TECHNICAL MANUAL WITH RPSTL' },
  ],

  entities: [
    { value: '', label: 'Select Entity' },
    { value: 'Marine Corps Systems Command', label: 'Marine Corps Systems Command' },
    { value: 'Portfolio Acquisition Executive-Marine Corps', label: 'Portfolio Acquisition Executive-Marine Corps' },
    { value: 'Portfolio Acquisition Executive-Mission Systems', label: 'Portfolio Acquisition Executive-Mission Systems' },
    { value: 'Program Executive Officer Digital and Enterprise Services', label: 'Program Executive Officer Digital and Enterprise Services' },
    { value: 'Program Executive Officer Land Systems', label: 'Program Executive Officer Land Systems' },
    { value: 'Xxxxx', label: 'Xxxxx' },
  ],

  services: [
    { value: '', label: 'Select Service' },
    { value: 'U.S. MARINE CORPS', label: 'U.S. MARINE CORPS' },
    { value: 'U.S. NAVY', label: 'U.S. NAVY' },
    { value: 'U.S. ARMY', label: 'U.S. ARMY' },
    { value: 'U.S. AIR FORCE', label: 'U.S. AIR FORCE' },
  ],

  addresses: [
    { value: '', label: 'Select Address' },
    { value: '2200 Lester Street, Quantico, VA 22134-5050', label: '2200 Lester Street, Quantico, VA 22134-5050' },
    { value: '1325 10th Street SE, Bldg 196, Suite 400, Washington, DC 20374-5147', label: '1325 10th Street SE, Bldg 196, Suite 400, Washington, DC 20374-5147' },
    { value: '## Street Address, City, State #####-####', label: '## Street Address, City, State #####-####' },
  ],

  categories: [
    { value: '', label: 'Select Category' },
    { value: 'CTI', label: 'CTI' },
    { value: 'CTI/EXPT', label: 'CTI/EXPT' },
    { value: 'critical technology', label: 'critical technology' },
    { value: 'export controlled', label: 'export controlled' },
    { value: 'foreign government information', label: 'foreign government information' },
    { value: 'International Agreements (IA)', label: 'International Agreements (IA)' },
    { value: 'software documentation', label: 'software documentation' },
    { value: 'vulnerability information', label: 'vulnerability information' },
    { value: 'XXXXX', label: 'XXXXX' },
  ],

  timeCompliance: [
    { value: '', label: 'Select Time Compliance' },
    { value: 'NORMAL', label: 'NORMAL' },
    { value: 'URGENT', label: 'URGENT' },
  ],

  signingAuthorities: [
    { value: '', label: 'Select Signing Authority' },
    { value: 'Program Manager', label: 'Program Manager' },
    { value: 'Product Manager', label: 'Product Manager' },
    { value: 'Xxxxx Xxxxx', label: 'Xxxxx Xxxxx' },
  ],

  controllingOffices: [
    { value: '', label: 'Select Controlling Office' },
    { value: 'Advanced Amphibious Assault', label: 'Advanced Amphibious Assault' },
    { value: 'Combat Support System', label: 'Combat Support System' },
    { value: 'Expeditionary Radars', label: 'Expeditionary Radars' },
    { value: 'Ground Based Air Defense', label: 'Ground Based Air Defense' },
    { value: 'Ground Weapons Systems', label: 'Ground Weapons Systems' },
    { value: 'Intelligence & Cyberspace Operations', label: 'Intelligence & Cyberspace Operations' },
    { value: 'Light Armored Vehicles', label: 'Light Armored Vehicles' },
    { value: 'MAGTF Command & Control', label: 'MAGTF Command & Control' },
    { value: 'Motor Transport', label: 'Motor Transport' },
    { value: 'Tactical Communications & Electromagnetic Warfare Systems', label: 'Tactical Communications & Electromagnetic Warfare Systems' },
    { value: 'Training Systems', label: 'Training Systems' },
    { value: 'Wargaming', label: 'Wargaming' },
    { value: 'Xxxxx Xxxxx', label: 'Xxxxx Xxxxx' },
  ],

  cuiCategories: [
    { value: '', label: 'Select CUI Category' },
    { value: 'CTI', label: 'CTI' },
    { value: 'CTI/EXPT', label: 'CTI/EXPT' },
    { value: 'DCNI', label: 'DCNI' },
    { value: 'DCRIT', label: 'DCRIT' },
    { value: 'NNPI', label: 'NNPI' },
    { value: 'PSI', label: 'PSI' },
  ],

  controlMarkings: [
    { value: '', label: 'Select Control' },
    { value: 'ATTORNY-CLIENT', label: 'ATTORNY-CLIENT' },
    { value: 'ATTORNEY-WP', label: 'ATTORNEY-WP' },
    { value: 'DISPLAY ONLY', label: 'DISPLAY ONLY' },
    { value: 'DL ONLY', label: 'DL ONLY' },
    { value: 'FEDCON', label: 'FEDCON' },
    { value: 'FED ONLY', label: 'FED ONLY' },
    { value: 'NOCON', label: 'NOCON' },
    { value: 'NOFORN', label: 'NOFORN' },
    { value: 'RELIDO', label: 'RELIDO' },
    { value: 'REL TO USA, LIST', label: 'REL TO USA, LIST' },
    { value: 'Xxxxx', label: 'Xxxxx' },
  ],

  supersedureNotice: [
    { value: '', label: 'None' },
    { value: 'SUPERSEDURE NOTICE', label: 'SUPERSEDURE NOTICE' },
  ],

  supersedureStatements: [
    { value: '', label: 'None' },
    { value: 'This publication supersedes TM #####X-##/#, dated Month YYYY.', label: 'This publication supersedes TM #####X-##/#, dated Month YYYY.' },
  ],

  destructionNotice: [
    { value: '', label: 'None' },
    { value: 'DESTRUCTION NOTICE', label: 'DESTRUCTION NOTICE' },
  ],

  classificationDestructionProcedures: [
    { value: '', label: 'Select Procedure' },
    { value: 'For classified documents, follow the procedures in DoD 5220.22-M, National Industrial Security Program Operating Manual and/or DoDM 5200.01, Information Security Program.', label: 'For classified documents, follow the procedures in DoD 5220.22-M, National Industrial Security Program Operating Manual and/or DoDM 5200.01, Information Security Program.' },
    { value: 'For unclassified, limited documents, destroy by any method that will prevent disclosure of contents or reconstruction of the document.', label: 'For unclassified, limited documents, destroy by any method that will prevent disclosure of contents or reconstruction of the document.' },
  ],

  distributionStatements: [
    { value: '', label: 'Select Distribution' },
    { value: 'UNLIMITED', label: 'UNLIMITED' },
    { value: 'OFFICIAL USE ONLY', label: 'OFFICIAL USE ONLY' },
    { value: 'LIMITED DISTRIBUTION', label: 'LIMITED DISTRIBUTION' },
  ],

  miStatements: [
    { value: '', label: 'None' },
    {
      value:
        'GCSS-MC Recording. Ensure appropriate records are updated in accordance with (IAW) GCSS-MC User Manual 4000-125, Vol 3.',
      label: 'GCSS-MC Recording (MIs)',
    },
  ],
};
