# Build R6 of the Recent Updates note (= R5 + the A5 correction in §1.1.14.6.2; owner-authorised 22-Sep-2026).
# R5 was built from the revision that is ACTUALLY INDEXED in the candidate set kb-pilot-c
# ("...AS-INDEXED-kb-pilot-c.docx", sha256 d10f3027…, recovered from git blob 619dbb92 @ 972f424d7).
#
# R4 put every action in ONE section. The parsed section then exceeded the chunker's 1200-character piece and
# crossed a page break, so the model was sent "Applies to all of the above: n" — the enforcement qualification was
# cut off. R5 gives each action its OWN sub-section, so each arrives with its role, switch and job-state conditions
# AND its enforcement qualification in the same chunk. Nothing is shortened to improve ranking; the document gets
# longer, not shorter, and every source reference is preserved.
#   python generated-docs/build_r5.py
import copy
import os

import docx

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "R3", "Technical - Recent Updates & Changed Behaviours (Operational) Notes.AS-INDEXED-kb-pilot-c.docx")
OUT = os.path.join(HERE, "R6", "Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx")

ENFORCE_GN = (
    "Enforcement: the gate tests the role the client forwards in the 'x-user-role' header; with no role header the "
    "server falls back to the built-in identity, which reports 'Sail Admin'. So this condition restricts only "
    "callers whose client forwards a role, and that value is caller-supplied, not verified. Read from source code; "
    "not measured on a running installation. [code: resolveGateRole = forwardedRole || user.role; "
    "middleware/auth.ts sets req.user.role = 'Sail Admin']"
)
ENFORCE_NOROLE = (
    "Enforcement: no role condition exists on this path, so the forwarded-role question above does not arise. The "
    "office condition that does apply — the vessel switch — is read from the database and cannot be set by the "
    "caller. Sign-in and vessel access are always required."
)

# (heading level, text) — level 0 = Heading 2 (the section), 1 = Heading 3 (one per action), None = List Bullet
BLOCKS: list[tuple[str, str]] = [
    ("h2", "1.1.14.6 Office Generation of Work Orders — Conditions by Action"),
    ("b", "Work orders can be produced from the office in two different ways, and created directly in a third. The "
          "conditions are NOT the same for all of them, so each is stated separately below with its own role, "
          "switch and job-state conditions and its own enforcement note. Normal sign-in and access to the vessel "
          "are required for every one of them."),

    ("h3", "1.1.14.6.1 Office 'Generate Now' — a whole vessel"),
    ("b", "What it does: on the Work Orders screen, with one vessel selected, 'Generate Now' runs an immediate, "
          "vessel-scoped generation instead of waiting for the daily sweep. [code: workOrderController.generateNow "
          "→ workOrderGenerationGate.evaluateDirectGeneration]"),
    ("b", "Conditions, both checked on the server: the caller's role must be Sail Admin, and that vessel's 'office "
          "work-order generation' switch must be enabled. The switch is off by default and a Sail Admin sets it per "
          "vessel on the 'Lead Time & Grace Period Settings' screen. [code: PROVISIONING_ROLE = 'Sail Admin'; "
          "isOfficeWoGenerationEnabled]"),
    ("b", ENFORCE_GN),

    ("h3", "1.1.14.6.2 Office 'Generate Now' — the refusal messages"),
    ("b", "Refusals are distinct. Not a Sail Admin: \"Only a Sail Admin may generate work orders directly from the "
          "office.\" Switch off: \"Office work-order generation is not enabled for this vessel. A Sail Admin can "
          "enable it per vessel on the Lead Time & Grace Period Settings screen.\" Vessel provisioning state "
          "unreadable: refused as well — the check fails closed. [code: evaluateDirectGeneration, codes "
          "ROLE_NOT_PERMITTED, OFFICE_GENERATION_DISABLED, VESSEL_STATE_UNKNOWN]"),
    # R6 (22-Sep-2026, owner-authorised): the R5 sentence "Both refusals belong to 'Generate Now' only" was WRONG —
    # only the ROLE refusal is exclusive to Generate Now; the SWITCH applies to per-job Generate WO as well
    # (open issue A5, docs/assistant-experiments/2026-09-15-kb-pilot/for-astra-2026-09-19c/DOC-ERROR-both-refusals.md).
    ("b", "Only the ROLE refusal belongs to 'Generate Now'. The SWITCH refusal does not: on the office instance, both "
          "'Generate Now' and the per-job 'Generate WO' route require the vessel's 'office work-order generation' "
          "switch, and per-job 'Generate WO' is refused with the same message when it is off. The Sail Admin role "
          "requirement belongs to 'Generate Now' only. Unplanned creation ('+ Unplanned W.O') requires neither the role "
          "nor the switch. [code: jobService.generateWorkOrder → isOfficeWoGenerationEnabled, the same check "
          "evaluateDirectGeneration uses; workOrderController.ts is the only caller of the Sail Admin gate]"),

    ("h3", "1.1.14.6.3 Office per-job 'Generate WO' — one job"),
    ("b", "What it does: on the Components page, opening a component's job and choosing a reason generates a work "
          "order for that one job. [code: jobService.generateWorkOrder]"),
    ("b", "Conditions: the vessel's 'office work-order generation' switch must be enabled, and the job must exist, "
          "be active and not already have an active work order; the reason must be Planning, Breakdown or Other. "
          "There is NO role check on this path — it does not go through the role gate, so any signed-in user with "
          "access to the vessel may use it while the switch is on. It is not limited to Sail Admin. [code: "
          "jobService.generateWorkOrder calls isOfficeWoGenerationEnabled only; "
          "jobDueScanner.generateWorkOrderForJob for the active-work-order check]"),
    ("b", ENFORCE_NOROLE),

    ("h3", "1.1.14.6.4 Unplanned work order"),
    ("b", "What it does: '+ Unplanned W.O' on the Work Orders screen creates a work order directly, outside the job "
          "schedule."),
    ("b", "Conditions: neither the Sail Admin rule nor the office work-order generation switch applies to it. "
          "[code: the create path does not call the generation gate]"),
    ("b", ENFORCE_NOROLE),

    ("h3", "1.1.14.6.5 Ship generation"),
    ("b", "Ships always generate their own work orders on their daily scan, regardless of the office switch: a ship "
          "instance is allowed through the gate before the role and switch tests are reached. [code: "
          "evaluateDirectGeneration returns allowed for isShip]"),
]


def _page_break():
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    br = OxmlElement("w:br")
    br.set(qn("w:type"), "page")
    return br


def set_text(p, text):
    for r in p.runs[1:]:
        r._element.getparent().remove(r._element)
    if p.runs:
        p.runs[0].text = text
    else:
        p.add_run(text)


def main():
    d = docx.Document(SRC)
    ps = d.paragraphs
    head = next(i for i, p in enumerate(ps) if p.text.startswith("1.1.14.6 "))
    end = next(i for i, p in enumerate(ps) if p.text.startswith("1.1.14.7 "))
    old_head, old_bullets = ps[head], ps[head + 1:end]
    assert all(p.style.name == "List Bullet" for p in old_bullets), [p.style.name for p in old_bullets]

    # build the new block list after the old heading, then delete every original paragraph of the section
    anchor = old_head
    for kind, text in BLOCKS:
        src = old_head if kind.startswith("h") else old_bullets[0]
        new = copy.deepcopy(src._element)
        anchor._element.addnext(new)
        para = docx.text.paragraph.Paragraph(new, src._parent)
        if kind == "h3":
            para.style = d.styles["Heading 3"]
        set_text(para, text)
        if kind == "h3":
            # the chunker splits each PAGE by headings, so a section that crosses a page break loses its tail into a
            # headingless "Preamble" chunk — which is exactly how the enforcement qualification was cut off in R4.
            # One page per action removes that possibility.
            para.runs[0]._element.addprevious(_page_break())
        anchor = para
    for p in [old_head, *old_bullets]:
        p._element.getparent().remove(p._element)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    d.save(OUT)
    out = docx.Document(OUT)
    i0 = next(i for i, p in enumerate(out.paragraphs) if p.text.startswith("1.1.14.5 "))
    for i, p in enumerate(out.paragraphs[i0:i0 + 22], i0):
        print(f"[{i}|{p.style.name}] {p.text[:96]}")


main()
