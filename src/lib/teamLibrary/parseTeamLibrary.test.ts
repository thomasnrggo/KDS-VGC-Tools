import { describe, expect, it } from "vitest";
import { parseCsv, parseSheetDate, parseTeamLibrary } from "./parseTeamLibrary";

// The sheet's layout: two banner rows, then the header (a quoted, two-line
// "Replica Code" cell), each slot "1"…"6" three columns wide with the item last.
const pad = (cells: (string | number)[]) => cells.join(",");
const HEADER = pad([
  "Team ID",
  "Team Description",
  "",
  "Full Name",
  "",
  "1",
  "",
  "",
  "2",
  "",
  "",
  "3",
  "",
  "",
  "4",
  "",
  "",
  "5",
  "",
  "",
  "6",
  "",
  "",
  "",
  "Pokepaste",
  "EVs",
  "Extracted paste?",
  "Replica Status",
  '"Replica Code\n(Click text for image)"',
  "Date Shared",
  "Tournament / Event",
  "Rank",
  "Link to Source",
  "Report / Video",
  "Other Links",
  "Owner",
  "",
  "Pokemon Text for Copypasta",
  "",
  "",
  "",
  "",
  "",
  "",
  "Team ID",
]);
function row(cells: {
  id: string;
  description: string;
  creator: string;
  items: string[];
  paste: string;
  evs: string;
  extracted: string;
  status: string;
  code: string;
  date: string;
  event: string;
  rank: string;
  source: string;
  owner: string;
  pokemon: string[];
}) {
  const slots = cells.items.flatMap((item) => ["", "", item]);
  return pad([
    cells.id,
    `"${cells.description}"`,
    "",
    cells.creator,
    "",
    ...slots,
    "",
    cells.paste,
    cells.evs,
    cells.extracted,
    cells.status,
    cells.code,
    cells.date,
    cells.event,
    cells.rank,
    cells.source,
    "-",
    "-",
    cells.owner,
    "",
    ...cells.pokemon,
    "",
    cells.id,
  ]);
}
const SIX = [
  "Incineroar",
  "Rillaboom",
  "Sneasler",
  "Kingambit",
  "Garchomp-Mega",
  "Floette-Eternal-Mega",
];
const ITEMS = [
  "Sitrus Berry",
  "Miracle Seed",
  "Focus Sash",
  "Life Orb",
  "Garchompite",
  "Floettite",
];
const CSV = [
  ",VGCPastes Repository (Champions M-C),,Total Team Count:,2",
  ",Click here to visit our Twitter!",
  HEADER,
  row({
    id: "MC2",
    description: "maGicaUra's Gdańsk Regional 2027 Runner Up Team",
    creator: "Jude Lee",
    items: ITEMS,
    paste: "https://pokepast.es/527dcd9007995d9e",
    evs: "Yes",
    extracted: "Extracted",
    status: "✔",
    code: "C8BN5AKEH8",
    date: "2 Nov 2026",
    event: "Gdańsk Regional 2027",
    rank: "Runner Up",
    source: "https://x.com/magicauravgc/status/1",
    owner: "magicauravgc",
    pokemon: SIX,
  }),
  row({
    id: "MC1",
    description: "Someone's Rain Team, v2",
    creator: "-",
    items: ITEMS,
    paste: "https://pokepast.es/abc",
    evs: "No",
    extracted: "Owner's",
    status: "X",
    code: "OLDCODE",
    date: "9 Sep 2026",
    event: "-",
    rank: "-",
    source: "-",
    owner: "someone",
    pokemon: SIX,
  }),
  pad(["", "", "", ""]),
].join("\r\n");

describe("parseCsv", () => {
  it("keeps quoted commas, newlines and doubled quotes in one field", () => {
    expect(parseCsv('a,"b, ""c""\nd",e\r\nf')).toEqual([["a", 'b, "c"\nd', "e"], ["f"]]);
  });
});

describe("parseSheetDate", () => {
  it("reads the sheet's dates", () => {
    expect(parseSheetDate("2 Nov 2026")).toBe("2026-11-02");
    expect(parseSheetDate("19 Sept 2026")).toBe("2026-09-19");
    expect(parseSheetDate("-")).toBeUndefined();
  });
});

describe("parseTeamLibrary", () => {
  const [runnerUp, rain, ...rest] = parseTeamLibrary(CSV);

  it("reads each team by the header's columns, skipping blank rows", () => {
    expect(rest).toEqual([]);
    expect(runnerUp).toEqual({
      id: "MC2",
      description: "maGicaUra's Gdańsk Regional 2027 Runner Up Team",
      creator: "Jude Lee",
      owner: "magicauravgc",
      pasteSource: "extracted",
      pokemon: SIX,
      items: ITEMS,
      hasStatPoints: true,
      pokepaste: "https://pokepast.es/527dcd9007995d9e",
      replicaCode: "C8BN5AKEH8",
      date: "2026-11-02",
      event: "Gdańsk Regional 2027",
      rank: "Runner Up",
      source: "https://x.com/magicauravgc/status/1",
    });
  });

  it("drops '-' blanks and unavailable rental codes, and credits the owner when no creator is named", () => {
    expect(rain).toEqual({
      id: "MC1",
      description: "Someone's Rain Team, v2",
      creator: "someone",
      owner: "someone",
      pasteSource: "owner",
      pokemon: SIX,
      items: ITEMS,
      hasStatPoints: false,
      pokepaste: "https://pokepast.es/abc",
      date: "2026-09-09",
    });
  });

  it("refuses a sheet whose columns changed", () => {
    expect(() => parseTeamLibrary(CSV.replace("Pokepaste", "Paste"))).toThrow(/Pokepaste/);
    expect(() => parseTeamLibrary("a,b\n1,2")).toThrow(/header/);
  });
});
