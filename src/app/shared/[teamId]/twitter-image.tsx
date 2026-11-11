// The same preview for X (Twitter) as for everything else.
export { default, alt, size, contentType } from "./opengraph-image";
// Route config can't be re-exported — Next reads it from this file itself.
export const revalidate = 300;
