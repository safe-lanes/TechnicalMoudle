// Component Register presentation only. Never change apiRequest's diagnostic contract.
const wording: Record<string, string> = {
  "Please fill all mandatory fields before saving.": "Complete the highlighted required fields before saving.",
  "Maker list is still loading. Please try again in a moment.": "The Maker List is loading. Wait a moment and try again.",
  "Please select a valid Maker from the Maker List.": "Select a valid maker from the Maker List.",
  "Maker not found in Maker List. Please select a valid Maker.": "Select a maker that exists in the Maker List.",
  "Maker Code not found in Maker List.": "Select a maker code that exists in the Maker List.",
  "Parent Component Code is required.": "Enter a parent component code.",
  "A component cannot be its own parent.": "Choose a different parent; a component cannot be its own parent.",
  "Stamp is mandatory when Rotational Item is Yes": "Select a stamp when Rotational Item is set to Yes.",
  "Stamp is mandatory when Rotational Item is Yes.": "Select a stamp when Rotational Item is set to Yes.",
  "Please select a RH Counter Source from MASTER components.": "Select a MASTER component as the RH Counter Source.",
  "MASTER counter type cannot have a master component reference": "A MASTER counter cannot inherit from another counter. Clear the RH Counter Source.",
  "INHERITED counter type requires rhMasterComponentId": "Select a MASTER component as the RH Counter Source for this inherited counter.",
  "rhMasterComponentId is required for INHERITED counter type": "Select a MASTER component as the RH Counter Source for this inherited counter.",
  "Master component not found": "The selected RH source was not found. Select an existing MASTER component.",
  "Master component must be from the same vessel": "Select an RH source from the same vessel.",
  "Referenced component is not a MASTER counter type": "Select an RH source configured as a MASTER counter.",
  "Selected component is not configured as a MASTER counter type": "Select an RH source configured as a MASTER counter.",
  "A component cannot inherit running hours from itself": "Select another MASTER component as the RH source.",
  "NOT_RH_DRIVEN counter type cannot have a master component reference": "Clear the RH Counter Source for a component that is not RH-driven.",
  "Component not found": "This component could not be found. Refresh the register and try again.",
  "Component deletion status can only be changed through the Delete Component action": "Use Delete Component to delete this component.",
  "Only vessel components can be deleted through the Component Register": "Only vessel components can be deleted from this register.",
  "File upload required - cannot create document without a file": "Choose a file before uploading the document.",
  "Invalid document data": "The document information is invalid. Check the selected component and file, then try again.",
  "Invalid componentId - component not found": "The selected component could not be found. Refresh the register and try again.",
  "componentCode mismatch - does not match component's code": "The document's component code does not match the selected component. Refresh the register and try again.",
  "vesselCode mismatch - does not match component's vessel": "The document's vessel does not match the selected component's vessel.",
  "Document not found": "This document could not be found. Refresh the document list and try again.",
  "Object storage not configured": "Document storage is temporarily unavailable. Try again later.",
  "Failed to upload file to object storage": "Document storage is temporarily unavailable. Try again later.",
  "Failed to create document record": "The document could not be saved. Try uploading it again.",
  "Failed to update component": "The component could not be saved. Check the entered values and try again.",
  "Failed to delete component": "The component could not be deleted. Refresh the register and try again.",
  "Failed to inactivate component": "The component could not be deactivated. Refresh the register and try again.",
  "Failed to update sort order": "The component order could not be saved. Refresh the register and try again.",
  "Insufficient permissions to download this document": "You do not have permission to download this document.",
  "Cannot generate work orders for an inactive job": "The job must be active before a work order can be created.",
  "componentCuuid is required": "Select a component before replacing its rotational item.",
  "Forbidden": "You do not have permission to perform this action.",
  "Unauthorized": "Your session could not be verified. Sign in and try again.",
  "vesselId is required": "Select a vessel and try again.",
};

const fieldLabels: Record<string, string> = {
  name: "Component Name", componentCode: "Component Code", parentId: "Parent Component Code",
  maker: "Maker", makerCode: "Maker Code", rhMasterComponentId: "RH Counter Source",
  file: "File", fileName: "File Name", componentId: "Component", vesselCode: "Vessel",
  componentCategory: "Component Category", eqptSystemDept: "Equipment / System Department",
  id: "Component", cuuid: "Component", newParentCode: "Parent Component Code",
  sortOrder: "Sort Order", fileType: "File Type", canShipView: "Ship View Permission",
  canShipDownload: "Ship Download Permission",
};

function readable(text: string): string {
  if (wording[text]) return wording[text];
  return text
    .replace(/^Missing mandatory fields: (.+)$/, "Complete these required fields: $1.")
    .replace(/^Cannot set mandatory fields to empty: (.+)$/, "These required fields cannot be empty: $1.")
    .replace(/^Invalid Equipment \/ System Department\. Allowed values are: /, "Select a valid Equipment / System Department: ")
    .replace(/^Invalid Component Category\. Allowed values are: /, "Select a valid component category: ")
    .replace(/^Component Code ('.*') already exists for this vessel\. Please use a unique code\.$/, "Component code $1 is already registered on this vessel. Enter a unique code.")
    .replace(/^Component Name ('.*') already exists for this vessel\. Please use a unique name\.$/, "Component name $1 is already registered on this vessel. Enter a unique name.")
    .replace(/^Invalid Parent Component Code format.*?\. Expected SFI format: /, "Enter a valid parent component code. Expected SFI format: ")
    .replace(/^Component Code and Parent Component Code are both ('.*')\. A component cannot be its own parent\.$/, "Choose a different parent; a component cannot be its own parent (code $1).")
    .replace(/^Parent Component Code ('.*') does not exist in the vessel's component register\. Cannot create a component without a valid parent\.$/, "Parent component $1 does not exist on this vessel. Select an existing parent.")
    .replace(/^Parent Component Code ('.*') does not exist in this vessel's component register\.$/, "Parent component $1 does not exist on this vessel. Select an existing parent.")
    .replace(/^Cannot change from MASTER: (.+)\. Reassign them first\.$/, "$1. Reassign their RH sources before changing this counter type.")
    .replace(/^Circular hierarchy detected:.+$/, "A component cannot be moved beneath one of its descendants. Choose a different parent.")
    .replace(/^(Stamp ".+") is retired and cannot be fitted to a component\.$/, "$1 is retired. Select an available stamp.")
    .replace(/^(Stamp ".+" is already installed on another component.*)\. Stamps must be unique\.$/, "$1. Select an available stamp.")
    .replace(/^Component not found: .+$/, "This component could not be found. Refresh the register and try again.")
    .replace(/^Document file not found.*$/, "The document file could not be found. Refresh the document list and try again.");
}

/**
 * Accept the existing status-prefixed Error, a body object, ordinary text, or
 * nested validation details. Traverse only message-bearing fields, never codes,
 * SQL diagnostics, stack, arbitrary values, or schema metadata.
 */
export function componentErrorDescription(error: unknown, fallback: string): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth = 0, field?: string) => {
    if (depth > 6 || value == null || seen.has(value)) return;
    if (typeof value === "string") {
      let text = value.trim().replace(/^\d{3}:\s*/, "");
      if (!text) return;
      if (/^[{["]/.test(text)) {
        try { visit(JSON.parse(text), depth + 1, field); return; } catch {
          // Quoted filenames are ordinary text, but malformed JSON is not.
          if (/^[{[]/.test(text)) return;
        }
      }
      // Fail closed on provider/database/runtime diagnostics and markup.
      if (/[<>{}]|\[object Object\]|\bat\s+\S+\s*\(|\b(?:SQLSTATE|ZodError|TypeError|SyntaxError|ReferenceError|stack trace|constraint|ECONN\w*|ENOENT|EACCES)\b|Error:|\/(?:tmp|home|workspace|var)\/|\b(?:invalid_type|invalid_string|23505|INTERNAL_SERVER_ERROR|PLANNED_WO_EXISTS)\b|\b(?:select .+ from|insert into|update .+ set|duplicate key value|relation .+ does not exist|column .+ does not exist|Reparent update matched)\b/i.test(text)) return;
      if (/^[A-Z][A-Z0-9_]+$/.test(text)) return;
      if (/Cannot read propert(?:y|ies)|\bis not a function\b|\bis not defined\b/i.test(text)) return;
      if (/^(?:Failed to fetch|Failed to load|fetch failed|NetworkError|Network request failed|Load failed|Internal Server Error|Bad Gateway|Service Unavailable|Unexpected token|Unexpected end|Request failed|Not Found|Validation failed|Invalid request data)(?:\b|$)/i.test(text)) return;
      // Structured schema errors must not expose expected/received internals.
      if (field && /^(Required|Invalid|Expected .+, received .+)$/i.test(text)) {
        text = `Check ${field} and enter a valid value.`;
      } else if (/^(Required|Invalid|Expected .+, received .+)$/i.test(text)) {
        return;
      } else {
        text = readable(text);
        if (field && !text.toLowerCase().includes(field.toLowerCase())) text = `${field}: ${text}`;
      }
      if (!messages.includes(text)) messages.push(text);
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1, field)); return; }
    const body = value as Record<string, unknown>;
    const path = Array.isArray(body.path) ? body.path : [];
    const pathField = [...path].reverse().find(key => typeof key === "string" && fieldLabels[key]);
    const label = typeof pathField === "string" ? fieldLabels[pathField] : field;
    visit(body.error, depth + 1, label);
    visit(body.message, depth + 1, label);
    for (const key of ["details", "errors", "issues"]) visit(body[key], depth + 1, label);
    // Some validation libraries return fieldErrors rather than issue arrays.
    if (body.fieldErrors && typeof body.fieldErrors === "object") {
      for (const [key, entry] of Object.entries(body.fieldErrors)) {
        if (fieldLabels[key]) visit(entry, depth + 1, fieldLabels[key]);
      }
    }
  };
  visit(error);
  return messages.length ? messages.join(" ") : fallback;
}

// For existing direct fetch callers: keep the body for safe presentation and
// dependency metadata rather than discarding it or failing on response.json().
export async function componentResponseError(response: Response): Promise<Error> {
  return new Error(`${response.status}: ${await response.text()}`);
}

/** Same blob-download behavior, but retain failed document bodies locally.
 * The shared download helper intentionally remains unchanged for other modules.
 */
export async function downloadComponentDocument(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw await componentResponseError(response);
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?["']?([^"';]+)/i)?.[1];
  let filename = disposition.match(/filename\s*=\s*["']?([^"';]+)/i)?.[1]?.trim() || "download";
  if (encoded) {
    try { filename = decodeURIComponent(encoded.trim()); } catch { filename = encoded.trim(); }
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
