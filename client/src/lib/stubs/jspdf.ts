/**
 * STUB — jspdf is temporarily unavailable due to a workspace security policy block.
 * PDF export features will show a user-facing error until the package is restored.
 * To restore: add "jspdf": "^3.0.4" back to package.json once the CVE block is lifted.
 */

class jsPDF {
  constructor(_opts?: unknown) {
    console.warn('[jsPDF stub] jspdf is blocked by the security policy. PDF export is unavailable.');
  }
  save(_filename?: string) { this._notAvailable(); }
  addPage() { return this; }
  setFontSize(_size: number) { return this; }
  setFont(_font: string, _style?: string) { return this; }
  setTextColor(..._args: unknown[]) { return this; }
  setFillColor(..._args: unknown[]) { return this; }
  setDrawColor(..._args: unknown[]) { return this; }
  setLineWidth(_w: number) { return this; }
  rect(..._args: unknown[]) { return this; }
  text(..._args: unknown[]) { return this; }
  line(..._args: unknown[]) { return this; }
  addImage(..._args: unknown[]) { return this; }
  internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  lastAutoTable = { finalY: 0 };
  private _notAvailable() {
    alert('PDF export is temporarily unavailable. The jspdf package is blocked by the workspace security policy. Please contact your administrator.');
  }
}

export { jsPDF };
export default jsPDF;
