import type { NatureModifier } from "@/types";

/** All 25 natures, keyed lowercase. The 5 "neutral" natures (Hardy, Docile, Serious, Bashful, Quirky) map to {}. */
export const NATURE_MODIFIERS: Record<string, NatureModifier> = {
  hardy: {},
  docile: {},
  serious: {},
  bashful: {},
  quirky: {},

  lonely: { increased: "atk", decreased: "def" },
  adamant: { increased: "atk", decreased: "spa" },
  naughty: { increased: "atk", decreased: "spd" },
  brave: { increased: "atk", decreased: "spe" },

  bold: { increased: "def", decreased: "atk" },
  impish: { increased: "def", decreased: "spa" },
  lax: { increased: "def", decreased: "spd" },
  relaxed: { increased: "def", decreased: "spe" },

  modest: { increased: "spa", decreased: "atk" },
  mild: { increased: "spa", decreased: "def" },
  rash: { increased: "spa", decreased: "spd" },
  quiet: { increased: "spa", decreased: "spe" },

  calm: { increased: "spd", decreased: "atk" },
  gentle: { increased: "spd", decreased: "def" },
  careful: { increased: "spd", decreased: "spa" },
  sassy: { increased: "spd", decreased: "spe" },

  timid: { increased: "spe", decreased: "atk" },
  hasty: { increased: "spe", decreased: "def" },
  jolly: { increased: "spe", decreased: "spa" },
  naive: { increased: "spe", decreased: "spd" },
};
