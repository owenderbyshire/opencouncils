/**
 * Council sites the data pipeline can't reach properly from GitHub's
 * machines, so it asks the website (hosted in London) to fetch them instead.
 * The relay fetches these hosts only, so it can't be used for anything else.
 */

/** Refuse connections from GitHub's machines: the pipeline always goes through the relay. */
export const PIPELINE_RELAY_HOSTS = new Set([
  "democracy.caerphilly.gov.uk",
  "moderngov.denbighshire.gov.uk",
  "committeemeetings.flintshire.gov.uk",
  "moderngov.wrexham.gov.uk",
  // Development plan documents that refuse GitHub's machines (November 2026).
  "swansea.gov.uk",
  "en.powys.gov.uk",
  "caerphilly.gov.uk",
  // Caerphilly's planning register refuses GitHub's machines (November 2026).
  "publicaccess.caerphilly.gov.uk",
  // Anglesey's new ModernGov address: its firewall refuses GitHub's machines (November 2026).
  "democracy.anglesey.gov.wales",
]);

/** Refuse report downloads from GitHub's machines. Checked by hand through the relay before the pipeline uses it. */
const REPORT_HOSTS = [
  "cardiff.moderngov.co.uk",
  "powys.moderngov.co.uk",
  "powysw.moderngov.co.uk",
  "torfaen.moderngov.co.uk",
  "rctcbc.moderngov.co.uk",
  "democracy.blaenau-gwent.gov.uk",
  "democracy.npt.gov.uk",
  // Planning registers that refuse GitHub's machines (checked by hand).
  "www.cardiffidoxcloud.wales",
  "publicaccess.newport.gov.uk",
  "property.swansea.gov.uk",
  "amg.gwynedd.llyw.cymru",
  "ceredigion-online.tascomi.com",
  "developmentservices.blaenau-gwent.gov.uk",
  "planning.denbighshire.gov.uk",
];

/** Every host the relay will fetch. */
export const RELAY_HOSTS = new Set([...PIPELINE_RELAY_HOSTS, ...REPORT_HOSTS]);
