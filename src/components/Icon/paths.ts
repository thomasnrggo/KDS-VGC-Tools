import { IconName } from "@/enums";

/**
 * Inline SVG path data for the handful of Material Symbols (Outlined) icons this
 * app actually uses — extracted from @material-symbols/svg-400 (same source as
 * the icon font, individually-optimized per-icon SVGs). Replaces loading the full
 * material-symbols icon font, which ships every glyph in the set as one ~3.8MB
 * woff2 for the 6 icons used here; see PLANNING.md for why that mattered enough
 * to fix. All paths share the same 0 -960 960 960 viewBox.
 *
 * ExpandMore uses keyboard_arrow_down's path — Material Symbols treats
 * "expand_more" and "keyboard_arrow_down" as the same glyph, but only the latter
 * ships as a standalone SVG file in this version of the icon set.
 */
export const ICON_PATHS: Record<IconName, string> = {
  [IconName.Add]: "M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z",
  [IconName.Close]:
    "m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z",
  [IconName.Delete]:
    "M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-41v-60h188v-30h264v30h188v60h-41v570q0 24-18 42t-42 18H261Zm438-630H261v570h438v-570ZM367-266h60v-399h-60v399Zm166 0h60v-399h-60v399ZM261-750v570-570Z",
  [IconName.Edit]:
    "M180-180h44l472-471-44-44-472 471v44Zm-60 60v-128l575-574q8-8 19-12.5t23-4.5q11 0 22 4.5t20 12.5l44 44q9 9 13 20t4 22q0 11-4.5 22.5T823-694L248-120H120Zm659-617-41-41 41 41Zm-105 64-22-22 44 44-22-22Z",
  [IconName.ExpandMore]: "M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z",
  [IconName.MoreVert]:
    "M479.86-160Q460-160 446-174.14t-14-34Q432-228 446.14-242t34-14Q500-256 514-241.86t14 34Q528-188 513.86-174t-34 14Zm0-272Q460-432 446-446.14t-14-34Q432-500 446.14-514t34-14Q500-528 514-513.86t14 34Q528-460 513.86-446t-34 14Zm0-272Q460-704 446-718.14t-14-34Q432-772 446.14-786t34-14Q500-800 514-785.86t14 34Q528-732 513.86-718t-34 14Z",
  [IconName.OpenInNew]:
    "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z",
  [IconName.Search]:
    "M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z",
};
