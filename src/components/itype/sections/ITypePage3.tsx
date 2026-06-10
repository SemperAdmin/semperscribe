import React from 'react';
import styles from '@/styles/itype-preview.module.css';
import {
  deriveService,
  deriveEntity,
  splitAddress,
  deriveAppropriatePublication,
  formatLongDate,
} from '@/lib/i-type/page3-derivations';

interface ITypePage3Props {
  formData?: any;
}

export const ITypePage3: React.FC<ITypePage3Props> = ({ formData }) => {
  const serviceDisplay = deriveService(formData?.service);
  const entityDisplay = deriveEntity(formData?.entity);
  const [addrLine1, addrLine2] = splitAddress(formData?.address);
  const dateDisplay = formatLongDate(formData?.date);
  const appropriatePublication = deriveAppropriatePublication(
    formData?.publicationType,
    formData?.shortTitle
  );

  return (
    <div className={styles.page3}>
      {/* Header block */}
      <div className={styles.page3Header}>
        <div className={styles.page3Service}>{serviceDisplay}</div>
        <div>{entityDisplay}</div>
        <div>{addrLine1}</div>
        {addrLine2 ? <div>{addrLine2}</div> : null}
      </div>

      {/* One blank line between the header address and the date. */}
      <div className={styles.page3Blank} />
      <div className={styles.page3Date}>{dateDisplay}</div>
      <div className={styles.page3Blank} />

      {/* 1 */}
      <div className={styles.page3Para}>
        <span className={styles.page3Num}>1.</span>
        <span>
          This {appropriatePublication} is authenticated for Marine Corps use and is effective
          upon receipt.
        </span>
      </div>

      {/* 2 */}
      <div className={styles.page3Para}>
        <span className={styles.page3Num}>2.</span>
        <span>
          Per MCO 5100.34_, Commanders, Commanding Officers, and Officers-In-Charge shall identify
          and report situations that negatively affect safety of operation via the Automated Message
          Handling System to: COMMARCORSYSCOM DCSEAL QUANTICO VA, PEO LS QUANTICO VA, CMC PPO
          WASHINGTON DC, CMC I WASHINGTON DC, CMC L WASHINGTON DC, and CMC DCI WASHINGTON DC.
          Individuals may report potential hazards to Marine Corps Systems Command System Safety at{' '}
          <span className={styles.page3Link}>smb_mcsc_safety@usmc.mil</span> and/or to Commandant of
          the Marine Corps Safety Division (CMC SD) at{' '}
          <span className={styles.page3Link}>hqmc_safety_division@usmc.mil</span>. All significant
          hazards that have the potential to affect other commands and require widespread
          dissemination shall be reported via a Hazard Report per MCO 5100.29_.
        </span>
      </div>

      {/* 3 */}
      <div className={styles.page3Para}>
        <span className={styles.page3Num}>3.</span>
        <span>
          Use TDM-Publications portal, at{' '}
          <span className={styles.page3Link}>https://app.mcboss.usmc.mil/</span>, as your central
          resource for all publication feedback and support. Please use this single portal to:
        </span>
      </div>

      <div className={styles.page3Sub}>
        <span className={styles.page3Num}>a.</span>
        <span>Submit a Change Request to report discrepancies or suggest changes.</span>
      </div>
      <div className={styles.page3Sub}>
        <span className={styles.page3Num}>b.</span>
        <span>
          Access Knowledge Base Articles (KBA) for self-help and guidance (including the Change
          Request Process).
        </span>
      </div>
      <div className={styles.page3Sub}>
        <span className={styles.page3Num}>c.</span>
        <span>Open a Support Case for any further questions not addressed by the KBA.</span>
      </div>

      {/* 4 */}
      <div className={styles.page3Para}>
        <span className={styles.page3Num}>4.</span>
        <span>
          For concerns/issues with the content/procedures contact Equipment Specialist or designated
          Program Office representative (Insert Name, Email, Phone, or Team/PM).
        </span>
      </div>

      {/* 5 - conditional MI statement (Select for MIs) */}
      {formData?.miStatement ? (
        <div className={styles.page3Para}>
          <span className={styles.page3Num}>5.</span>
          <span>{formData.miStatement}</span>
        </div>
      ) : null}

      {/* Authentication block */}
      <div className={styles.page3Official}>OFFICIAL</div>
      <div className={styles.page3SigSpace} />
      <div>NAME OF SIGNING OFFICIAL</div>
      <div>{formData?.signingAuthority || ''}</div>
      <div>{formData?.controllingOffice || ''}</div>

      <div className={styles.page3Distribution}>DISTRIBUTION: EDO</div>
    </div>
  );
};
