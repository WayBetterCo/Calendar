export function isEditingField(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}
