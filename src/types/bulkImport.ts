export interface BulkImportResult {
  importedCount: number;
  /** "<label>: <reason>" for each entry that couldn't be imported. */
  skipped: string[];
}
