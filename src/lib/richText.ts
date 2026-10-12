/** True when rich text (RichTextEditor HTML) or plain text has any visible text — "<p></p>" and whitespace count as empty. */
export function hasRichText(value: string | undefined): boolean {
  return !!value && value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() !== "";
}
