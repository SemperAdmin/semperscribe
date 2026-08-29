/**
 * External links surfaced in the app UI, kept in one place so a
 * destination change is a one-line edit.
 */

/**
 * Where every "Send Feedback" control points (footer, Actions menu,
 * Settings). An externally hosted form — the app itself makes no
 * network calls; this only opens a new tab.
 */
export const FEEDBACK_URL = 'https://forms.osi.apps.mil/r/k5QWzJDL9P';

/**
 * Where the header seal points: the Semper Admin portal that fronts
 * this app and its sibling tools. Opens in a new tab like every other
 * external link here, because there is no beforeunload guard and a
 * same-tab navigation would walk away from an unsaved draft.
 */
export const PORTAL_URL = 'https://semper-admin-portal.app.cloud.gov/';
