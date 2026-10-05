import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComponentLoadErrors } from "../components/ComponentLoadErrors";
import { componentErrorDescription, componentResponseError } from "./componentErrorFeedback";

const fallback = "The component could not be saved. Check the entered values and try again.";
const transport = (body: unknown) => new Error(`400: ${JSON.stringify(body)}`);
const maker = "Maker and Maker Code combination not found in Maker List. Please select a valid Maker.";

test("screenshot rejection preserves exact Maker advice without changing transport Error", () => {
  const error = transport({ error: maker });
  const original = error.message;
  assert.equal(componentErrorDescription(error, fallback), maker);
  assert.equal(error.message, original);
});

test("ordinary text and unrelated validations are not mislabeled as Maker errors", () => {
  for (const message of [
    "You do not have permission to edit components.",
    'Stamp "Pump-A" was just taken or changed by another update. Refresh and pick an available stamp.',
    "Current Reading (123 RH) cannot be lower than the latest Running Hours value (456 RH recorded on 2026-10-01). Correct the reading before continuing.",
  ]) {
    assert.equal(componentErrorDescription(new Error(`409: ${message}`), fallback), message);
  }
});

test("nested validation details retain useful fields but not schema codes or duplicates", () => {
  assert.equal(componentErrorDescription(transport({
    error: "Check the component fields.",
    details: { issues: [
      { path: ["makerCode"], message: "Required", code: "invalid_type", expected: "string", received: "undefined" },
      { path: ["parentId"], message: "Choose an existing parent.", code: "custom" },
      { path: ["parentId"], message: "Choose an existing parent.", code: "custom" },
    ] },
    stack: "Error at service (server.ts:14:1)",
    code: "INTERNAL_VALIDATION_CODE",
  }), fallback), "Check the component fields. Check Maker Code and enter a valid value. Parent Component Code: Choose an existing parent.");
  assert.equal(componentErrorDescription({ details: { fieldErrors: { makerCode: ["Required"] } } }, fallback),
    "Check Maker Code and enter a valid value.");
  assert.equal(componentErrorDescription(transport({ error: "Invalid request data", details: [
    { path: ["updates", 0, "sortOrder"], message: "Expected number, received string", code: "invalid_type" },
  ] }), fallback), "Check Sort Order and enter a valid value.");
});

test("nested serialized errors and repeated explanations are unwrapped once", () => {
  assert.equal(componentErrorDescription({ error: { message: `400: ${JSON.stringify({ error: maker })}`, details: { error: maker } } }, fallback), maker);
});

test("malformed, missing, network, HTML, schema, SQL, stack and code-only bodies fail closed", () => {
  const invalid: unknown[] = [
    undefined, null, {}, 45, "[object Object]", new Error("400: {invalid"),
    new Error("502: <html><body>Bad Gateway</body></html>"), new Error("Failed to fetch"),
    new Error("Unexpected end of JSON input"), new Error("SyntaxError: invalid JSON"),
    { error: { database: "secret diagnostics" } }, { error: "ACTIVE_JOBS" },
    { error: "duplicate key value violates unique constraint components_code" },
    { error: "relation components does not exist" }, { error: "Error: boom\n at f (/home/runner/server.ts:1)" },
    { error: "Invalid request {internal: value}" }, { errors: [{ message: "Expected string, received number" }] },
    new TypeError("Cannot read properties of null (reading 'error')"),
  ];
  for (const input of invalid) assert.equal(componentErrorDescription(input, fallback), fallback, String(input));
});

test("operation-specific fallbacks remain distinct", () => {
  for (const message of [
    "The document could not be uploaded. Try again.",
    "The component could not be deactivated. Refresh the register and try again.",
    "The component order could not be saved. Refresh the register and try again.",
    "The change request could not be submitted. Check your changes and try again.",
    "The component export file could not be created. Try again.",
  ]) assert.equal(componentErrorDescription(new Error("500: {bad"), message), message);
});

test("required, duplicate, parent and RH wording retains dynamic values", () => {
  const examples = [
    ["Missing mandatory fields: Component Name, Parent Component Code", "Complete these required fields: Component Name, Parent Component Code."],
    ["Cannot set mandatory fields to empty: Is Active", "These required fields cannot be empty: Is Active."],
    ["Component Code '612.001' already exists for this vessel. Please use a unique code.", "Component code '612.001' is already registered on this vessel. Enter a unique code."],
    ["Component Name 'O'Brien Pump' already exists for this vessel. Please use a unique name.", "Component name 'O'Brien Pump' is already registered on this vessel. Enter a unique name."],
    ["Invalid Parent Component Code format '612.foo'. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc.", "Enter a valid parent component code. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc."],
    ["Cannot change from MASTER: 2 component(s) inherit from this counter (Pump, Motor). Reassign them first.", "2 component(s) inherit from this counter (Pump, Motor). Reassign their RH sources before changing this counter type."],
    ["INHERITED counter type requires rhMasterComponentId", "Select a MASTER component as the RH Counter Source for this inherited counter."],
  ];
  for (const [before, after] of examples) assert.equal(componentErrorDescription(transport({ error: before }), fallback), after);
});

test("dependency counts and required corrective actions survive lifecycle parsing", () => {
  for (const [code, message, countKey] of [
    ["ACTIVE_CHILDREN", "Component has 3 active child component(s). Please deactivate the child components first.", "activeChildrenCount"],
    ["ACTIVE_JOBS", "Component cannot be deleted because 4 active Job(s) are linked. Please deactivate or delete the linked Jobs before deleting the component.", "activeJobsCount"],
    ["ACTIVE_SPARES", "Component cannot be deleted because 5 active Spare(s) are linked. Please deactivate or delete the linked Spares before deleting the component.", "linkedSparesCount"],
  ]) {
    const error = transport({ error: message, code, [countKey]: 3 });
    assert.equal(componentErrorDescription(error, fallback), message);
    assert.ok(error.message.includes(countKey));
  }
});

test("stamp instructions, names and permission denials are retained", () => {
  for (const message of [
    'Stamp "Pump-A" not found in Rotation Item Master. Create it first under PMS → Admin → Master Data → Rotation Item Master List (or bulk import), then select it here.',
    "Cannot access documents from other vessels",
  ]) assert.equal(componentErrorDescription(transport({ error: message }), fallback), message);
  assert.equal(componentErrorDescription(transport({
    error: 'Stamp "Pump-A" is already installed on another component (O\'Brien Motor) on this vessel. Stamps must be unique.',
  }), fallback), 'Stamp "Pump-A" is already installed on another component (O\'Brien Motor) on this vessel. Select an available stamp.');
});

test("direct fetch rejects safely even with non-JSON response bodies", async () => {
  for (const body of [JSON.stringify({ error: maker }), "Select an existing parent.", "<html>error</html>", "{bad", ""]) {
    const error = await componentResponseError(new Response(body, { status: 400 }));
    assert.equal(componentErrorDescription(error, fallback),
      body.startsWith("{\"") ? maker : body === "Select an existing parent." ? body : fallback);
  }
});

test("load errors render as failures, not empty results, with escaped dynamic text", () => {
  const html = renderToStaticMarkup(React.createElement(ComponentLoadErrors, {
    failures: [["Documents <img src=x>", transport({ error: "Document not found" })], ["Jobs", null]],
  }));
  assert.ok(html.includes("Load Failed"));
  assert.ok(html.includes("not an empty result"));
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(!html.includes("<img src=x>"));
  assert.ok(!html.includes("Jobs Load Failed"));
});

test("both save catches only report failures and leave form state and navigation alone", () => {
  for (const file of ["ComponentRegisterAddEdit.tsx", "AddEditComponentForm.tsx"]) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
    const saveCatch = source.match(/} catch \(error: any\) \{\s*toast\(\{\s*title: "Component Save Failed",[\s\S]*?} finally \{/);
    assert.ok(saveCatch);
    assert.ok(saveCatch[0].includes("componentErrorDescription(error"));
    assert.ok(!/onClose|onBack|setComponentData|setDraftJobs|setLocation/.test(saveCatch[0]));
    assert.ok(source.includes('This field is required'));
  }
});
