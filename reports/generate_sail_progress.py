"""Build the concise, editable SAIL PMS stakeholder report.

Run with: python reports/generate_sail_progress.py
The source workbooks provide reporting categories, not verified current quantities.
"""

from pathlib import Path

import xlsxwriter


OUTPUT = Path(__file__).with_name("SAIL_PMS_Progress_Report.xlsx")
NAVY = "#23465F"
TEAL = "#3F8791"
LIGHT = "#EDF4F7"
PAPER = "#F6F8FA"
INPUT = "#FFF5DC"
INK = "#263B4A"
MUTED = "#657989"
WHITE = "#FFFFFF"
STATUS = [
    "Not Started", "In Progress", "Partially Completed", "Completed",
    "Pending Wah Kwong Input", "Pending Wah Kwong Action", "Pending SAIL Action",
    "Pending Review", "On Hold", "Not Applicable",
]


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb = xlsxwriter.Workbook(str(OUTPUT))
    wb.set_properties({
        "title": "SAIL PMS Project Progress Report",
        "subject": "Editable stakeholder update; no unverified operational values",
        "comments": "Source categories: supplied SAIL weekly tracker, PMS data building quantification and report brief.",
    })
    fmt = {
        "title": wb.add_format({"bold": True, "font_size": 20, "font_color": WHITE, "bg_color": NAVY, "valign": "vcenter"}),
        "subtitle": wb.add_format({"font_size": 10, "font_color": MUTED, "bg_color": PAPER, "text_wrap": True, "valign": "vcenter"}),
        "section": wb.add_format({"bold": True, "font_color": WHITE, "bg_color": TEAL, "font_size": 11, "valign": "vcenter"}),
        "head": wb.add_format({"bold": True, "font_color": WHITE, "bg_color": NAVY, "text_wrap": True, "valign": "vcenter", "border": 1, "border_color": WHITE}),
        "label": wb.add_format({"font_color": INK, "bold": True, "valign": "vcenter", "text_wrap": True, "bottom": 1, "bottom_color": "#DCE7ED"}),
        "plain": wb.add_format({"font_color": INK, "valign": "vcenter", "text_wrap": True, "bottom": 1, "bottom_color": "#DCE7ED"}),
        "input": wb.add_format({"font_color": INK, "bg_color": INPUT, "valign": "vcenter", "text_wrap": True, "bottom": 1, "bottom_color": "#E8DBC0"}),
        "number": wb.add_format({"font_color": INK, "bg_color": INPUT, "num_format": "#,##0", "bottom": 1, "bottom_color": "#E8DBC0"}),
        "date": wb.add_format({"font_color": INK, "bg_color": INPUT, "num_format": "dd mmm yyyy", "bottom": 1, "bottom_color": "#E8DBC0"}),
        "calc": wb.add_format({"font_color": NAVY, "bg_color": LIGHT, "num_format": '#,##0;[Red](#,##0);0', "bottom": 1, "bottom_color": "#D1E5E7"}),
        "pct": wb.add_format({"font_color": NAVY, "bg_color": LIGHT, "num_format": "0.0%", "bottom": 1, "bottom_color": "#D1E5E7"}),
        "value": wb.add_format({"font_color": TEAL, "bold": True, "font_size": 14, "bg_color": LIGHT, "num_format": "0.0%", "align": "center", "valign": "vcenter"}),
        "count": wb.add_format({"font_color": TEAL, "bold": True, "font_size": 14, "bg_color": LIGHT, "num_format": '#,##0;[Red](#,##0);0', "align": "center", "valign": "vcenter"}),
        "note": wb.add_format({"font_color": MUTED, "italic": True, "font_size": 9, "text_wrap": True, "valign": "vcenter"}),
        "box": wb.add_format({"font_color": INK, "bg_color": INPUT, "text_wrap": True, "valign": "top", "border": 1, "border_color": "#E8DBC0"}),
        "small": wb.add_format({"font_color": INK, "bg_color": LIGHT, "text_wrap": True, "valign": "vcenter"}),
        "warn": wb.add_format({"bg_color": "#FADBD8", "font_color": "#9C2820"}),
    }
    dash = wb.add_worksheet("Dashboard")
    track = wb.add_worksheet("Update Tracker")
    dash.set_tab_color(TEAL)
    track.set_tab_color(NAVY)
    dash.hide_gridlines(2)
    track.hide_gridlines(2)
    dash.set_zoom(85)
    track.set_zoom(80)
    dash.set_landscape()
    track.set_landscape()
    dash.fit_to_pages(1, 1)
    track.fit_to_pages(1, 0)
    dash.set_margins(.35, .35, .45, .45)
    track.set_margins(.3, .3, .45, .45)
    dash.print_area("A1:R40")
    track.print_area("A1:L60")
    track.repeat_rows(0, 3)
    dash.set_footer("&CSAIL PMS • Stakeholder update     &RPage &P of &N")
    track.set_footer("&CSAIL PMS • Update Tracker     &RPage &P of &N")

    track.set_column("A:A", 34)
    track.set_column("B:B", 16)
    track.set_column("C:D", 17)
    track.set_column("E:G", 15)
    track.set_column("H:H", 18)
    track.set_column("I:K", 17)
    track.set_column("L:L", 32)
    track.freeze_panes(5, 1)
    track.merge_range("A1:L2", "SAIL PMS  |  UPDATE TRACKER", fmt["title"])
    track.set_row(0, 24)
    track.set_row(1, 20)
    track.merge_range("A3:L3", "Yellow = editable input   •   Pale blue = calculated   •   Blank = not confirmed; enter 0 only when confirmed. All quantities are whole, nonnegative counts.", fmt["subtitle"])
    track.set_row(2, 27)

    def section(row, text):
        track.merge_range(f"A{row}:L{row}", text, fmt["section"])
        track.set_row(row - 1, 22)

    def header(row, values):
        for col, text in enumerate(values):
            track.write(row - 1, col, text, fmt["head"])
        track.set_row(row - 1, 33)

    def grouped_header(row, groups):
        for address, text in groups:
            if ":" in address:
                track.merge_range(address, text, fmt["head"])
            else:
                track.write(address, text, fmt["head"])
        track.set_row(row - 1, 36)

    def textrow(row, label, input_cols=(), calc_cols=(), pct_cols=()):
        track.write(f"A{row}", label, fmt["label"])
        for col in "BCDEFGHIJKL":
            if col in pct_cols:
                track.write_blank(f"{col}{row}", None, fmt["pct"])
            elif col in calc_cols:
                track.write_blank(f"{col}{row}", None, fmt["calc"])
            elif col in input_cols:
                style = fmt["number"] if col in "BCDEFG" else fmt["date"] if col in "JK" else fmt["input"]
                track.write_blank(f"{col}{row}", None, style)
            else:
                track.write_blank(f"{col}{row}", None, fmt["plain"])
        track.set_row(row - 1, 34)

    def formula(cell, expression, percent=False):
        track.write_formula(cell, expression, fmt["pct"] if percent else fmt["calc"], "")

    def difference(total, part):
        return f'=IF(AND(ISNUMBER({total}),ISNUMBER({part}),{part}<={total}),{total}-{part},"")'

    def ratio(numerator, denominator):
        return f'=IF(AND(ISNUMBER({numerator}),ISNUMBER({denominator}),{denominator}>0,{numerator}<={denominator}),{numerator}/{denominator},"")'

    section(5, "01  /  SAIL TEAM — DATA RECEIVED & LOADED")
    header(6, ["Data category", "Total expected", "Received", "Loaded in SAIL", "Not received", "Received %", "Loaded %", "Status", "Owner", "Last updated", "Target date", "Remarks / evidence"])
    for row, label in enumerate(["Components", "Jobs", "Spares", "Stores", "Maker list"], 7):
        textrow(row, label, "BCDHIJKL", "E", "FG")
        formula(f"E{row}", difference(f"B{row}", f"C{row}"))
        formula(f"F{row}", ratio(f"C{row}", f"B{row}"), True)
        formula(f"G{row}", ratio(f"D{row}", f"B{row}"), True)
    track.merge_range(
        "A12:L12",
        "Dashboard data % = Components 30% + Jobs 30% + Spares 30% + Stores 10%; Maker list is excluded. All four expected counts must be confirmed and greater than zero; missing or zero denominators keep the weighted KPI blank.",
        fmt["note"],
    )
    track.set_row(11, 30)

    section(14, "02  /  SAIL TEAM — COMPONENTS MISSING JOBS OR SPARES")
    grouped_header(15, [
        ("A15", "Gap"), ("B15", "No. of components"),
        ("C15:F15", "Affected component IDs / names"),
        ("G15", "Status"), ("H15", "Owner"), ("I15", "Target date"),
        ("J15", "Last updated"), ("K15:L15", "Next action / remarks"),
    ])
    for row, label in [(16, "Missing jobs"), (17, "Missing spares")]:
        track.write(f"A{row}", label, fmt["label"])
        track.write_blank(f"B{row}", None, fmt["number"])
        track.merge_range(f"C{row}:F{row}", "", fmt["input"])
        for col in "GH":
            track.write_blank(f"{col}{row}", None, fmt["input"])
        for col in "IJ":
            track.write_blank(f"{col}{row}", None, fmt["date"])
        track.merge_range(f"K{row}:L{row}", "", fmt["input"])
        track.set_row(row - 1, 34)
    track.merge_range("A18:L18", "List affected components by ID or name. A component missing both jobs and spares may appear in both rows; these counts must not be added together.", fmt["note"])
    track.set_row(17, 26)

    section(20, "03  /  SAIL TEAM — CRITICAL COMPONENTS, SPARES & JOBS RECEIPT")
    grouped_header(21, [
        ("A21", "Critical category"), ("B21", "Total expected"),
        ("C21", "Received"), ("D21", "Not received"), ("E21", "Received %"),
        ("F21", "Status"), ("G21", "Owner"), ("H21", "Last updated"),
        ("I21", "Target date"), ("J21:L21", "Remarks / evidence"),
    ])
    for row, label in [(22, "Critical Components"), (23, "Critical Spares"), (24, "Critical Jobs")]:
        track.write(f"A{row}", label, fmt["label"])
        for col in "BC":
            track.write_blank(f"{col}{row}", None, fmt["number"])
        formula(f"D{row}", difference(f"B{row}", f"C{row}"))
        formula(f"E{row}", ratio(f"C{row}", f"B{row}"), True)
        for col in "FG":
            track.write_blank(f"{col}{row}", None, fmt["input"])
        for col in "HI":
            track.write_blank(f"{col}{row}", None, fmt["date"])
        track.merge_range(f"J{row}:L{row}", "", fmt["input"])
        track.set_row(row - 1, 32)
    track.merge_range("A25:L25", "Critical receipt is tracked separately from overall data receipt. Blank = unconfirmed; enter 0 only when confirmed. No RH marking or approval metrics are included in this action sheet.", fmt["note"])
    track.set_row(24, 27)

    section(27, "04  /  CLIENT-SIDE ACTIVITIES — INPUTS, REVIEWS & DECISIONS TO CONFIRM")
    grouped_header(28, [
        ("A28", "Activity / requirement"), ("B28", "Total required"),
        ("C28", "Done / supplied"), ("D28", "Remaining"),
        ("E28", "Status"), ("F28", "Priority"), ("G28", "Owner"),
        ("H28", "Target date"), ("I28", "Completed date"),
        ("J28", "Last updated"), ("K28:L28", "Next action / remarks"),
    ])
    activities = [
        "Equipment register / source data",
        "Maker manuals collection",
        "Supporting documentation",
        "Task procedures / instructions",
        "PMS interval verification",
        "Spare parts source data",
        "Component-job-spare mapping inputs",
        "Criticality / risk review",
        "Class / statutory task review",
        "SMS / final verification",
        "Data quality / missing-field clarifications",
        "PMS changes: client decisions",
    ]
    for row, label in enumerate(activities, 29):
        track.write(f"A{row}", label, fmt["label"])
        for col in "BCEFGHIJ":
            style = fmt["number"] if col in "BC" else fmt["date"] if col in "HIJ" else fmt["input"]
            track.write_blank(f"{col}{row}", None, style)
        formula(f"D{row}", difference(f"B{row}", f"C{row}"))
        track.merge_range(f"K{row}:L{row}", "", fmt["input"])
        track.set_row(row - 1, 30)
    track.merge_range("A41:L41", "Client activities are a checklist, not assumed open or assigned. Leave unconfirmed owners, quantities, dates and statuses blank.", fmt["note"])
    track.set_row(40, 25)

    section(44, "05  /  SAIL TEAM — WORK ORDERS GENERATED TILL NOW")
    grouped_header(45, [
        ("A45", "Measure"), ("B45", "No. of WOs"), ("C45", "Status"),
        ("D45", "Owner"), ("E45", "Last updated"), ("F45:L45", "Remarks / evidence"),
    ])
    for row, label in enumerate(
        ["Generated till now", "Due", "Overdue", "Active", "Pending approval", "Completed"],
        46,
    ):
        track.write(f"A{row}", label, fmt["label"])
        track.write_blank(f"B{row}", None, fmt["number"])
        for col in "CD":
            track.write_blank(f"{col}{row}", None, fmt["input"])
        track.write_blank(f"E{row}", None, fmt["date"])
        track.merge_range(f"F{row}:L{row}", "", fmt["input"])
        track.set_row(row - 1, 32)
    track.merge_range("A52:L52", "Enter independent WO counts as of the reporting date. Statuses may overlap; do not sum them. One job can generate multiple WOs across cycles, so no jobs-based WO percentage is shown.", fmt["note"])
    track.set_row(51, 30)

    section(54, "06  /  SAIL TEAM — RH MACHINERY / VESSEL UPDATES")
    grouped_header(55, [
        ("A55", "Machinery scope"), ("B55", "RH machinery created"),
        ("C55", "Vessel RH details updated"), ("D55", "Not updated"),
        ("E55", "Updated %"), ("F55", "Status"), ("G55", "Owner"),
        ("H55", "Last updated"), ("I55", "Target date"),
        ("J55:L55", "Remarks / evidence"),
    ])
    track.write("A56", "RH Machinery", fmt["label"])
    for col in "BC":
        track.write_blank(f"{col}56", None, fmt["number"])
    formula("D56", difference("B56", "C56"))
    formula("E56", ratio("C56", "B56"), True)
    for col in "FG":
        track.write_blank(f"{col}56", None, fmt["input"])
    for col in "HI":
        track.write_blank(f"{col}56", None, fmt["date"])
    track.merge_range("J56:L56", "", fmt["input"])
    track.set_row(55, 36)
    track.merge_range("A57:L57", "Created = RH machinery records in scope. Vessel updated = records for which the vessel has entered RH details. Not updated and Updated % calculate only when counts are confirmed.", fmt["note"])
    track.set_row(56, 30)
    track.merge_range("A59:L59", "UPDATE GUIDE  /  YELLOW = EDITABLE   •   PALE BLUE = CALCULATED   •   BLANK = UNKNOWN   •   0 = CONFIRMED NONE", fmt["section"])
    track.merge_range("A60:L60", "Set reporting details and short commentary on Dashboard. Confirm numbers with source owners before sharing; this workbook is not connected to live SAIL PMS data.", fmt["note"])

    numeric_ranges = ["B7:D11", "B16:B17", "B22:C24", "B29:C40", "B46:B51", "B56:C56"]
    for area in numeric_ranges:
        track.data_validation(area, {"validate": "integer", "criteria": ">=", "value": 0, "ignore_blank": True, "error_title": "Nonnegative count required", "error_message": "Enter a confirmed whole number or leave blank."})
    for area in ("H7:H11", "G16:G17", "F22:F24", "E29:E40", "C46:C51", "F56"):
        track.data_validation(area, {"validate": "list", "source": STATUS, "ignore_blank": True})
    track.data_validation("F29:F40", {"validate": "list", "source": ["High", "Medium", "Low"], "ignore_blank": True})
    for area in ("J7:K11", "I16:J17", "H22:I24", "H29:J40", "E46:E51", "H56:I56"):
        track.data_validation(area, {"validate": "date", "criteria": "between", "minimum": "1900-01-01", "maximum": "2100-12-31", "ignore_blank": True})
    for area in ("F7:G11", "E22:E24", "E56"):
        track.conditional_format(area, {"type": "data_bar", "bar_color": "#4BA6AA", "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 1})
    for row in range(7, 12):
        track.conditional_format(f"C{row}:D{row}", {"type": "formula", "criteria": f'=AND(ISNUMBER(C{row}),ISNUMBER(D{row}),D{row}>C{row})', "format": fmt["warn"]})
    for row in range(22, 25):
        track.conditional_format(f"C{row}", {"type": "formula", "criteria": f'=AND(ISNUMBER(C{row}),ISNUMBER(B{row}),C{row}>B{row})', "format": fmt["warn"]})
    for row in range(29, 41):
        track.conditional_format(f"C{row}", {"type": "formula", "criteria": f'=AND(ISNUMBER(C{row}),ISNUMBER(B{row}),C{row}>B{row})', "format": fmt["warn"]})
    track.conditional_format("C56", {"type": "formula", "criteria": '=AND(ISNUMBER(C56),ISNUMBER(B56),C56>B56)', "format": fmt["warn"]})

    # Dashboard: no synthetic composite score; unlike counts, these denominators
    # represent different domains and should not be blended into an "overall %" .
    dash.set_column("A:A", 4)
    dash.set_column("B:B", 27)
    dash.set_column("C:C", 17)
    dash.set_column("D:D", 18)
    dash.set_column("E:E", 4)
    dash.set_column("F:F", 5)
    dash.set_column("G:G", 29)
    dash.set_column("H:H", 17)
    dash.set_column("I:I", 17)
    dash.set_column("J:J", 4)
    dash.set_column("K:K", 16)
    dash.set_column("L:L", 13)
    dash.set_column("J:R", 11.5)
    dash.set_column("U:Z", 16, None, {"hidden": True})
    dash.merge_range("A1:R2", "SAIL PMS  |  PROJECT PROGRESS", fmt["title"])
    dash.set_row(0, 25)
    dash.set_row(1, 20)
    dash.merge_range("A3:R3", "Stakeholder view   /   Data percentages are weighted: Components 30%, Jobs 30%, Spares 30%, Stores 10% (Maker list excluded). Enter confirmed counts and client actions on Update Tracker.", fmt["subtitle"])
    dash.set_row(2, 28)
    for label_cell, value_cell, label in [
        ("B5", "C5", "Reporting period"),
        ("G5", "H5", "Last updated"),
        ("B6", "C6", "Responsible person"),
        ("G6", "H6", "Reporting to / audience"),
    ]:
        dash.write(label_cell, label, fmt["label"])
        dash.write_blank(value_cell, None, fmt["date"] if value_cell == "H5" else fmt["input"])
    dash.merge_range("C5:D5", "", fmt["input"])
    dash.merge_range("C6:D6", "", fmt["input"])
    dash.merge_range("H6:I6", "", fmt["input"])
    dash.data_validation("H5", {"validate": "date", "criteria": "between", "minimum": "1900-01-01", "maximum": "2100-12-31"})

    dash.merge_range("B8:D8", "SAIL TEAM  /  DELIVERY", fmt["section"])
    dash.merge_range("G8:I8", "CLIENT SIDE  /  ACTIONS TO CONFIRM", fmt["section"])
    # Weighted KPIs use the four categories with confirmed weights.
    # Maker list remains tracked but is not included in these percentages.
    weighted_rows = [(7, 0.30), (8, 0.30), (9, 0.30), (10, 0.10)]

    def weighted_expression(value_col):
        return "+".join(
            f"{weight:g}*'Update Tracker'!{value_col}{row}/'Update Tracker'!B{row}"
            for row, weight in weighted_rows
        )

    received = (
        '=IF(AND(COUNT(\'Update Tracker\'!B7:B10)=4,'
        'COUNT(\'Update Tracker\'!C7:C10)=4,'
        'COUNTIF(\'Update Tracker\'!B7:B10,">0")=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!C7:C10>=0))=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!C7:C10<=\'Update Tracker\'!B7:B10))=4),'
        f'{weighted_expression("C")},"")'
    )
    loaded = (
        '=IF(AND(COUNT(\'Update Tracker\'!B7:B10)=4,'
        'COUNT(\'Update Tracker\'!C7:C10)=4,'
        'COUNT(\'Update Tracker\'!D7:D10)=4,'
        'COUNTIF(\'Update Tracker\'!B7:B10,">0")=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!C7:C10>=0))=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!C7:C10<=\'Update Tracker\'!B7:B10))=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!D7:D10>=0))=4,'
        'SUMPRODUCT(--(\'Update Tracker\'!D7:D10<=\'Update Tracker\'!C7:C10))=4),'
        f'{weighted_expression("D")},"")'
    )
    critical_received_pct = (
        '=IF(AND(COUNT(\'Update Tracker\'!B22:B24)=3,'
        'COUNT(\'Update Tracker\'!C22:C24)=3,SUM(\'Update Tracker\'!B22:B24)>0,'
        'SUMPRODUCT(--(\'Update Tracker\'!C22:C24<=\'Update Tracker\'!B22:B24))=3),'
        'SUM(\'Update Tracker\'!C22:C24)/SUM(\'Update Tracker\'!B22:B24),"")'
    )
    kpis = [
        (10, "Data received (weighted)", received, "30 / 30 / 30 / 10 weight", "value"),
        (12, "Data loaded (weighted)", loaded, "30 / 30 / 30 / 10 weight", "value"),
        (14, "Missing jobs", '=IF(ISNUMBER(\'Update Tracker\'!B16),\'Update Tracker\'!B16,"")', "Components affected", "count"),
        (16, "Missing spares", '=IF(ISNUMBER(\'Update Tracker\'!B17),\'Update Tracker\'!B17,"")', "Components affected", "count"),
        (18, "Critical items received", critical_received_pct, "Received / expected", "value"),
        (20, "WOs generated till now", '=IF(ISNUMBER(\'Update Tracker\'!B46),\'Update Tracker\'!B46,"")', "Cumulative count", "count"),
    ]
    for row, label, expression, detail, style in kpis:
        dash.write(f"B{row}", label, fmt["label"])
        dash.write_formula(f"D{row}", expression, fmt[style], "")
        dash.write(f"C{row}", detail, fmt["note"])
        dash.set_row(row - 1, 34)
    dash.write("B22", "RH machinery updated", fmt["label"])
    dash.write("C22", "Vessel updated / created", fmt["note"])
    dash.write_formula("D22", '=IF(ISNUMBER(\'Update Tracker\'!E56),\'Update Tracker\'!E56,"")', fmt["value"], "")
    dash.set_row(21, 34)
    dash.merge_range("B23:D24", "WO status counts can overlap. Repeated cycles can produce several WOs per job; no jobs-based percentage.", fmt["small"])
    dash.set_row(22, 24)
    dash.set_row(23, 24)
    dash.write("G10", "Open items (confirmed)", fmt["label"])
    open_statuses = ["Not Started", "In Progress", "Partially Completed", "Pending Wah Kwong Input", "Pending Wah Kwong Action", "Pending SAIL Action", "Pending Review", "On Hold"]
    counts = "+".join(f'COUNTIF(\'Update Tracker\'!$E$29:$E$40,"{s}")' for s in open_statuses)
    dash.write_formula("I10", f'=IF(COUNTA(\'Update Tracker\'!$E$29:$E$40)=0,"",{counts})', fmt["count"], "")
    dash.write("G12", "Activities without status", fmt["label"])
    dash.write_formula("I12", '=COUNTA(\'Update Tracker\'!$A$29:$A$40)-COUNTA(\'Update Tracker\'!$E$29:$E$40)', fmt["count"], 12)
    dash.write("G14", "Completed activities", fmt["label"])
    dash.write_formula("I14", '=IF(COUNTA(\'Update Tracker\'!$E$29:$E$40)=0,"",COUNTIF(\'Update Tracker\'!$E$29:$E$40,"Completed"))', fmt["count"], "")
    dash.merge_range("G16:I18", "Only confirmed statuses count as open or complete. Unassessed activities are listed separately; they are not assumed pending.", fmt["small"])
    dash.merge_range("G20:I20", "CLIENT STATUS / REMARKS", fmt["section"])
    dash.merge_range("G21:I23", "", fmt["box"])
    dash.merge_range("J8:R8", "CLIENT-SIDE ACTIVITY STATUS", fmt["section"])

    # The chart reports the assessment state of the listed client-side activities.
    # Blank statuses remain a distinct "Not assessed" slice, never zeroed into open.
    helper_statuses = [
        ("Completed", '=COUNTIF(\'Update Tracker\'!$E$29:$E$40,"Completed")', 0),
        ("Open", f"={counts}", 0),
        ("Not Applicable", '=COUNTIF(\'Update Tracker\'!$E$29:$E$40,"Not Applicable")', 0),
        ("Not assessed", '=COUNTA(\'Update Tracker\'!$A$29:$A$40)-COUNTA(\'Update Tracker\'!$E$29:$E$40)', 12),
    ]
    dash.write("U1", "Activity status")
    dash.write("V1", "Count")
    for row, (label, formula, cached) in enumerate(helper_statuses, 2):
        dash.write(f"U{row}", label)
        dash.write_formula(f"V{row}", formula, None, cached)

    chart = wb.add_chart({"type": "pie"})
    chart.add_series({
        "name": "Client-side activities",
        "categories": ["Dashboard", 1, 20, 4, 20],
        "values": ["Dashboard", 1, 21, 4, 21],
        "points": [
            {"fill": {"color": "#4E9D91"}, "border": {"color": WHITE}},
            {"fill": {"color": "#E3AD52"}, "border": {"color": WHITE}},
            {"fill": {"color": "#899BA7"}, "border": {"color": WHITE}},
            {"fill": {"color": "#C9DCE5"}, "border": {"color": WHITE}},
        ],
        "data_labels": {
            "percentage": True,
            "position": "best_fit",
            "font": {"name": "Calibri", "size": 9, "bold": True, "color": NAVY},
        },
    })
    chart.set_title({
        "name": "Activity assessment",
        "name_font": {"name": "Calibri", "size": 13, "bold": True, "color": NAVY},
    })
    chart.set_style(10)
    chart.set_legend({
        "position": "bottom",
        "font": {"name": "Calibri", "size": 9, "color": MUTED},
    })
    chart.show_hidden_data()
    chart.set_chartarea({"fill": {"color": WHITE}, "border": {"color": "#DCE7ED", "width": 1}})
    chart.set_plotarea({"fill": {"color": WHITE}, "border": {"none": True}})
    chart.set_size({"width": 500, "height": 300})
    dash.insert_chart("J9", chart, {"x_offset": 5, "y_offset": 5})
    dash.merge_range("J20:R20", "CRITICAL ITEMS  /  RECEIPT", fmt["section"])
    critical_chart_headers = [
        ("Y", 24, "Received", "C"),
        ("Z", 25, "Not received", "D"),
    ]
    dash.write("X1", "Critical category")
    for helper_col, _, label, _ in critical_chart_headers:
        dash.write(f"{helper_col}1", label)
    for helper_row, (category, tracker_row) in enumerate(
        [("Components", 22), ("Spares", 23), ("Jobs", 24)], start=2
    ):
        dash.write(f"X{helper_row}", category)
        for helper_col, _, _, tracker_col in critical_chart_headers:
            dash.write_formula(
                f"{helper_col}{helper_row}",
                f'=IF(ISNUMBER(\'Update Tracker\'!{tracker_col}{tracker_row}),\'Update Tracker\'!{tracker_col}{tracker_row},"")',
                None,
                "",
            )
    critical_chart = wb.add_chart({"type": "bar", "subtype": "clustered"})
    for (helper_col, helper_index, label, _), color in zip(critical_chart_headers, ["#4E9D91", "#C9DCE5"]):
        critical_chart.add_series({
            "name": ["Dashboard", 0, helper_index, 0, helper_index],
            "categories": ["Dashboard", 1, 23, 3, 23],
            "values": ["Dashboard", 1, helper_index, 3, helper_index],
            "fill": {"color": color},
            "border": {"color": color},
            "data_labels": {"value": True, "position": "outside_end", "font": {"name": "Calibri", "size": 8, "color": INK}},
        })
    critical_chart.set_title({
        "name": "Critical items received vs not received",
        "name_font": {"name": "Calibri", "size": 11, "bold": True, "color": NAVY},
    })
    critical_chart.set_x_axis({"name": "Number of items", "major_gridlines": {"visible": False}, "num_font": {"size": 8, "color": MUTED}})
    critical_chart.set_y_axis({"name": "Critical category", "num_font": {"size": 8, "color": MUTED}})
    critical_chart.set_legend({"position": "bottom", "font": {"name": "Calibri", "size": 8, "color": MUTED}})
    critical_chart.set_chartarea({"fill": {"color": WHITE}, "border": {"color": "#DCE7ED", "width": 1}})
    critical_chart.set_plotarea({"fill": {"color": WHITE}, "border": {"none": True}})
    critical_chart.set_size({"width": 500, "height": 255})
    critical_chart.show_hidden_data()
    dash.insert_chart("J21", critical_chart, {"x_offset": 5, "y_offset": 3})
    dash.merge_range("J37:R38", "Enter total and received counts for Critical Components, Spares and Jobs to populate this chart.", fmt["small"])
    dash.merge_range("B25:I25", "REPORTING NOTES  /  EDITABLE", fmt["section"])
    for row, label in [(26, "Key completed points"), (28, "Pending points / next actions"), (30, "Major risks / gaps"), (32, "Other remarks")]:
        dash.write(f"B{row}", label, fmt["label"])
        dash.merge_range(f"C{row}:I{row+1}", "", fmt["box"])
        dash.set_row(row - 1, 27)
        dash.set_row(row, 21)
    dash.merge_range("B34:I34", "No unrelated metrics are averaged. Aggregate percentages require all applicable counts; blank KPIs mean not confirmed, not zero.", fmt["note"])
    dash.merge_range("B35:I35", "WORK ORDERS  /  RH MACHINERY SNAPSHOT", fmt["section"])
    for row, left_label, left_cell, right_label, right_cell in [
        (36, "Due", "B47", "Overdue", "B48"),
        (37, "Active", "B49", "Pending approval", "B50"),
        (38, "Completed", "B51", "RH machinery created", "B56"),
        (39, "Vessel RH details updated", "C56", "RH not updated", "D56"),
    ]:
        dash.write(f"B{row}", left_label, fmt["label"])
        dash.write_formula(f"D{row}", f'=IF(ISNUMBER(\'Update Tracker\'!{left_cell}),\'Update Tracker\'!{left_cell},"")', fmt["count"], "")
        dash.write(f"G{row}", right_label, fmt["label"])
        dash.write_formula(f"I{row}", f'=IF(ISNUMBER(\'Update Tracker\'!{right_cell}),\'Update Tracker\'!{right_cell},"")', fmt["count"], "")
        dash.set_row(row - 1, 28)
    dash.freeze_panes(8, 0)
    dash.print_area("A1:R40")
    wb.close()
    print(OUTPUT)


if __name__ == "__main__":
    main()