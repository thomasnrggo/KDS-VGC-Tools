export interface BulkImportResult {
  importedCount: number;
  /** How many of importedCount were added as variants of an existing group. */
  variantCount: number;
  /** "<label>: <reason>" for each entry that couldn't be imported. */
  skipped: string[];
}
