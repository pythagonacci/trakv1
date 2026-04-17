export type TextBlockBlurDocumentState = {
  visibilityState: Document["visibilityState"];
  hasFocus: () => boolean;
};

export function shouldPreserveTextBlockEditModeOnBlur(doc: TextBlockBlurDocumentState) {
  return doc.visibilityState === "hidden" || !doc.hasFocus();
}
