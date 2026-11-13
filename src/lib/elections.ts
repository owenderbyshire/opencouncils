import type { CouncilElection } from "@data/curated/elections";
import type { Locale } from "@/i18n/config";
import { electionMessages } from "@/i18n/messages/elections";
import { partyName } from "@/lib/parties";

/** "Labour majority", "No overall control", and so on, for one council. */
export function controlText(locale: Locale, e: CouncilElection): string {
  const t = electionMessages[locale];
  const party = e.control.party === "ind" ? t.independents : partyName(locale, e.control.party, null);
  return t.control[e.control.kind].replace("{party}", party);
}
