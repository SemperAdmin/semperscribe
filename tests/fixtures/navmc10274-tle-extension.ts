/**
 * The owner's TLE-extension request of 2026-10-19 (AA_Form_4650_TLE_Extension_v3),
 * the file the preview/export handoff of 2026-10-21 was measured on, with
 * every personal detail replaced by a placeholder OF THE SAME LENGTH so the
 * seven paragraphs wrap to the same line counts. Seven level-1 paragraphs,
 * two vias, five references, four enclosures, a typed name.
 */
import type { FormData, ParagraphData } from '@/types';

export const TLE_EXTENSION_FIXTURE = {
  "formData": {
    "documentType": "aa-form",
    "date": "19 Oct 26",
    "actionNo": "",
    "ssic": "4650",
    "from": "MSgt First M. Lastname 1234567890/0111 USMC",
    "orgStation": "MATSG-23 TRNG COM NAS PENSACOLA FL\n211 FARRAR RD\nPENSACOLA FL 32508-5009",
    "to": "Per Diem, Travel, and Transportation Allowance Committee Staff\n4800 Mark Center Drive, Suite 05E22\nAlexandria, VA 22350-9000",
    "subj": "REQUEST FOR TEMPORARY LODGING EXPENSE EXTENSION PENDING HOUSEHOLD GOODS DELIVERY",
    "sig": "F. M. LASTNAME",
    "startingReferenceLevel": "a",
    "startingEnclosureNumber": "1"
  },
  "vias": [
    "Commanding Officer, Marine Aviation Training Support Group 23",
    "Deputy Commandant for Manpower and Reserve Affairs (MPO)"
  ],
  "references": [
    "JTR, par. 050601",
    "JTR, par. 050604",
    "37 U.S.C. 452(b)(11)",
    "CMC Washington DC Basic Orders of 14 May 26",
    "CO MCBH ltr 1321 IPAC of 22 Sep 26"
  ],
  "enclosures": [
    "MATSG-23 Reporting Endorsement of 3 Oct 26",
    "Sentinel Int'l Forwarding Inc. email of 14 Oct 26",
    "Defense Personal Property System shipment record, MLNQ0657262 (RDD 16 Nov 26)",
    "Navy Lodge Pensacola Certificate of Non-Availability of 19 Sep 26"
  ],
  "copyTos": [
    ""
  ],
  "paragraphs": [
    {
      "id": 1,
      "level": 1,
      "content": "Per references (a), (b), and (c), I request extension of Temporary Lodging Expense (TLE) for my spouse and me from 22 October 2026 through 16 November 2026, a period of 26 days, for a total of 47 TLE days under this Permanent Change of Station (PCS)."
    },
    {
      "id": 2,
      "level": 1,
      "content": "I reported to MATSG-23 on 1 October 2026 under references (d) and (e), per enclosure (1), on PCS from Marine Corps Base Hawaii. My spouse and I have occupied temporary lodging since 1 October 2026. Our 21 days of TLE under reference (a) end on 21 October 2026."
    },
    {
      "id": 3,
      "level": 1,
      "content": "Our household goods (HHG) were picked up in Hawaii on 2 September 2026 as Code 4 shipment ABCD0000000. Per enclosure (2), the container is in transit by vessel with arrival at the Port of Jacksonville on 17 October 2026. Per enclosure (3), the Required Delivery Date (RDD) is 16 November 2026. The destination agent reports a two-week delivery queue once the shipment reaches its warehouse. Our permanent residence at 100 Sample Street Way, Anytown, FL, remains unfurnished and uninhabitable until delivery."
    },
    {
      "id": 4,
      "level": 1,
      "content": "Navy Lodge Pensacola is unable to accommodate us, per enclosure (4). NAS Pensacola Family Housing referred me to Navy Gateway Inns and Suites Pensacola for lodging non-availability. The Commanding Officer's endorsement forwards the Navy Gateway Inns and Suites certificate and the Family Housing referral."
    },
    {
      "id": 5,
      "level": 1,
      "content": "I do not assert this shipment meets the shipping restriction criteria of reference (a), paragraph 050601-B4, since the shipment remains within the Defense Transportation Regulation standard transit time. I request the extension under the unusual, extraordinary, or hardship circumstance authority of reference (c). The 26-day gap between the end of TLE and the RDD results from the Government-set report date and the transit standard for an OCONUS Code 4 shipment, both outside my control. Extended TLE computed per reference (b), with the reduction for the daily non-locality BAH Transit rate, totals approximately $3,711."
    },
    {
      "id": 6,
      "level": 1,
      "content": "Per reference (a), paragraph 050601-B4, I request the Commanding Officer, MATSG-23, validate no Government housing option accommodates my spouse and me at NAS Pensacola, and the Marine Corps member of the Military Advisory Panel forward this request and supporting documentation to the Per Diem, Travel, and Transportation Allowance Committee staff for decision."
    },
    {
      "id": 7,
      "level": 1,
      "content": "If approved, I will register with the installation official, provide written updates on HHG delivery status every 10 days or fewer, retain all lodging receipts, forwarded to date with the Commanding Officer's endorsement, and end TLE on the date of HHG delivery. My point of contact is (850) 555-0100 or firstm.lastname@usmc.mil."
    }
  ]
} as {
  formData: Partial<FormData> & { documentType: 'aa-form' };
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
};
