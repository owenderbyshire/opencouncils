import { sql, type SQL } from "drizzle-orm";

/**
 * Current councillors by party and group, for one council or all of them,
 * with the council's ID on each row. Placeholder entries named "Vacant" or
 * "Vacancy" are not councillors. The site (src/data/elections.ts) and the
 * pipeline (council overviews) both count seats with this query; group the
 * rows with seatGroups() in ./seats.ts.
 */
export function currentSeatsQuery(councilId?: string): SQL {
  return sql`
    select council_id as "councilId", party_id as "partyId",
      case when party_id is null then coalesce(nullif(trim(party_label), ''), 'No party recorded') end as label,
      count(*)::int as seats
    from councillors where current and name !~* '^vacan(cy|t)\\b' ${councilId ? sql`and council_id = ${councilId}` : sql``}
    group by 1, 2, 3 order by 1, 4 desc`;
}
