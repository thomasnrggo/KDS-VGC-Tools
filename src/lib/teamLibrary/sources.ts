/** The VGCPastes Repository — the community's public sheet of shared teams, the Team Library's source. Full credit to it and each team's creator. */
export const VGCPASTES_SHEET_ID = "1axlwmzPA49rYkqXh7zHvAtSP-TKbM0ijGYBPRflLSWw";

/** Each regulation's tab in the sheet (its `gid`) — add the next one when VGCPastes opens it. */
export const TEAM_LIBRARY_TABS: Record<string, string> = {
  "regulation-m-c": "2001945654",
  "regulation-m-b": "1458357160",
  "regulation-m-a": "791705272",
};

/** The sheet in a browser, at a regulation's tab — for the credit link. */
export function vgcPastesSheetUrl(regulationId?: string): string {
  const gid = regulationId ? TEAM_LIBRARY_TABS[regulationId] : undefined;
  return `https://docs.google.com/spreadsheets/d/${VGCPASTES_SHEET_ID}/edit${gid ? `#gid=${gid}` : ""}`;
}

/** A tab's CSV export — public, no sign-in. */
export function vgcPastesCsvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${VGCPASTES_SHEET_ID}/export?format=csv&gid=${gid}`;
}
