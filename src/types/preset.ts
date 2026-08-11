/** A pre-built default opponent set, loaded as a bulk team-folder import — see src/data/presets. */
export interface TeamPreset {
  /** Stable identifier — bump when a regulation's set changes rather than editing in place. */
  id: string;
  /** Shown on the "load default set" button. */
  label: string;
  rawPaste: string;
}
