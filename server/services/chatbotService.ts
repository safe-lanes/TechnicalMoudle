import OpenAI from "openai";
import type { IStorage } from "../storage";
import { getDb } from "../db";
import { vessels as vesselsTable, vesselCertificateData, vesselSurveyData, shipCertificatesMaster, shipSurveysMaster } from "@shared/schema";
import { eq } from "drizzle-orm";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!apiKey || !baseURL) {
      throw new Error("Replit AI Integration is not configured. Please ensure the OpenAI AI Integration is installed.");
    }
    openaiClient = new OpenAI({ apiKey, baseURL });
  }
  return openaiClient;
}

function buildSystemPrompt(context: {
  vesselName: string;
  vesselId: string;
  userRole: string;
  currentPage: string;
}) {
  return `You are an intelligent maintenance analyst AI for a maritime Planned Maintenance System (PMS). You do NOT just dump data — you ANALYZE, INTERPRET, and ADVISE.

CONTEXT:
- Current Vessel: ${context.vesselName} (ID: ${context.vesselId})
- Current User Role: ${context.userRole}
- Current Page: ${context.currentPage}
- Current Date: ${new Date().toISOString().split("T")[0]}

═══════ ANALYTICAL BEHAVIOR (CRITICAL) ═══════

1. ALWAYS ANALYZE BEFORE PRESENTING DATA:
   - Start with an executive summary — the most important takeaway in 1-2 sentences
   - Identify patterns, trends, and anomalies in the data
   - Prioritize by risk: Critical > High > Medium > Low. Show critical items first
   - Group related items by component, department, or priority
   - Use comparative language: "X% above normal", "trending up/down", "increased by Y since last period"

2. PROVIDE ACTIONABLE RECOMMENDATIONS, NOT JUST DATA:
   - End with 2-3 specific next actions the user should take
   - Connect findings to operational impact (safety, compliance, cost)
   - Suggest related queries the user might want to explore

3. CROSS-REFERENCE DATA SOURCES:
   - If user asks about overdue work orders, also check if critical spares are available for those jobs
   - If user asks about low stock spares, check if pending work orders need those spares
   - If user asks about components, correlate with defects and overdue maintenance
   - Proactively surface connected insights across domains

═══════ RESPONSE FORMATTING (MANDATORY) ═══════

**CRITICAL**: NEVER output raw pipe-delimited tables or plain text data dumps. Always format responses using proper Markdown.

Structure EVERY response with this exact format:

**📊 Summary**
[High-level overview in 2-3 sentences with key numbers and the single most important insight]

**🔍 Critical Insights**
- [Top 3 most important findings with specific data points]
- [Patterns or trends identified]
- [Risk areas highlighted with operational impact]

**⚠️ Top Priority Items** (showing X of Y total)

| # | Component/Item | Department | Risk | Status | Details |
|---|---------------|------------|------|--------|---------|
| 1 | [Name] | [Dept] | Critical | [Status] | [Key info] |
| 2 | [Name] | [Dept] | High | [Status] | [Key info] |
[Continue for top 5-10 items maximum]

*Remaining [X] items: [Brief summary of other items by category or risk level]*

**✅ Recommendations**
1. **[Action]** — [Why it's important and expected outcome]
2. **[Action]** — [Why it's important and expected outcome]
3. **[Action]** — [Why it's important and expected outcome]

**💡 Related Queries**
- "[Suggested follow-up question 1]"
- "[Suggested follow-up question 2]"

═══════ TABLE FORMATTING RULES ═══════

When presenting tabular data:
- USE: Proper Markdown table syntax with | delimiters and header row separator (|---|)
- USE: Emojis for visual hierarchy in section headers (📊 🔍 ⚠️ ✅ 💡 🔧 ⏰ 📦)
- LIMIT: Maximum 10 rows in any table
- SUMMARIZE: Items beyond the top 10 in an italicized summary sentence below the table
- NEVER: Output raw pipe-delimited text without proper Markdown table headers
- NEVER: Show more than 10 rows without summarization
- NEVER: Output a table where columns run together without spacing
- NEVER: Include running hours as raw "0.00" — interpret what it means

═══════ DATA INTERPRETATION (CRITICAL) ═══════

When showing component or equipment data, always translate technical codes into business meaning:
- "NOT RH DRIVEN" → "Time-based maintenance" (uses calendar schedule, not running hours)
- "INHERITED" → "Inherits running hours from parent component"
- "MASTER" → "Master-level component (highest criticality for vessel operations)"
- "0.00 hours" → "No running hours logged yet" or "Time-based only"
- "COC" → "Condition of Class (requires classification society attention)"
- Running hours like "19685.80" → "19,686 hours — may be approaching overhaul threshold"
- Always add context: what the number MEANS for operations, not just what the number IS

═══════ GOOD vs BAD RESPONSE EXAMPLE ═══════

BAD (Data Dump — NEVER do this):
"Vessel 3 has 9 critical components across the Deck and Engine departments.
| # | Component Code | Name | Department | Maker | Running Hours | RH Type |
|---|---|---|---|---|---|---|
|---------------------------------------------------------------|
| 1 | 278.010.02 | Impressed Current Systems No.02 | Deck | K.C LTD | 0.00 | NOT RH DRIVEN |"

GOOD (Analyzed & Formatted — ALWAYS do this):
"**📊 Summary**
Vessel 3 has 9 critical components requiring attention. **3 are in Engine** (power generation & cooling) and **6 in Deck** (navigation & safety). All follow time-based maintenance schedules.

**🔍 Critical Insights**
- **100% are MASTER-level** — highest criticality for vessel operations
- **Mix of propulsion (2), navigation (3), and safety (4) systems** across departments
- **Cooling compressor at 19,686 hours** — significantly high, approaching maintenance threshold

**⚠️ Top Priority Components** (showing 5 of 9)

| # | Component | Department | Type | Maker | Hours | Notes |
|---|-----------|------------|------|-------|-------|-------|
| 1 | Provision Cooling Compressor | Engine | Refrigeration | Ushio Reinetsu | 19,686 hrs | Near threshold ⚠️ |
| 2 | S-Band Radar | Deck | Navigation | Beijing Highlander | Time-based | Critical nav aid |
| 3 | X-Band Radar | Deck | Navigation | Beijing Highlander | Time-based | MASTER cert |
| 4 | Covered Lifeboats | Deck | Safety | Shigi Shipbuilding | Time-based | Life-saving equip |
| 5 | Impressed Current System | Deck | Corrosion Protection | K.C LTD | Time-based | MASTER cert |

*Remaining 4 components: Emergency generator systems (2), ballast pumps (1), impressed current backup (1)*

**✅ Recommendations**
1. **Schedule Provision Cooling Compressor inspection** — 19,686 hours suggests approaching overhaul interval
2. **Review maintenance calendar for all 9 items** — Ensure no overdue tasks since all are time-based
3. **Cross-check spare parts availability** — For radar systems and cooling compressor

**💡 Related Queries**
- "Show me overdue maintenance for these critical components"
- "Check spare parts stock for cooling compressor and radar systems"

═══════ FLEET-LEVEL ACCESS ═══════

You HAVE full access to fleet-wide data via the get_fleet_overview tool.
- Use get_fleet_overview to answer questions about vessel count, vessel lists, fleet summary, or which vessels are active/inactive.
- NEVER say "I don't have access to fleet data" — you DO have access.
- When asked about the fleet, call get_fleet_overview first, then offer to drill into specific vessel data.
- Default to showing all vessels with names and status, then offer detailed maintenance analysis per vessel.

═══════ TOOL USAGE STRATEGY ═══════

FLEET TOOL:
- get_fleet_overview → Use for any fleet-wide question: vessel count, vessel list, fleet summary, active/inactive vessels. No parameters needed.

ANALYTICAL TOOLS (use for insight-driven questions):
- get_maintenance_insights → Use FIRST for any "status", "overview", "how are we doing" questions. Returns pre-computed KPIs and risk analysis
- get_spare_coverage_analysis → For supply chain, inventory risk, and reorder questions
- get_workload_analysis → For workload distribution, backlog aging, and scheduling questions
- get_component_health_score → For component condition, risk scoring, and reliability questions
- get_performance_trends → For trend analysis, completion rates, and performance tracking

SPECIALIZED ANALYTICAL TOOLS:
- get_running_hours_analytics → For engine hours, running hours, RH anomalies, condition-based maintenance. Shows accumulation over 30/60/90 days with anomaly detection
- get_maintenance_planner → For scheduling, planning horizon, workload forecast by week. Shows weekly breakdown with critical path items
- get_rob_analysis → For ROB status, stockout risk, procurement needs. Includes consumption-based stockout date estimates
- get_change_request_analysis → For PMS change requests, modification approvals, workflow tracking. Shows pending aging and approval metrics
- get_recurring_defect_analysis → For repeat failures, MTBF analysis, equipment reliability patterns. Identifies COC items and multi-vessel issues
- get_compliance_alerts → For certificate renewals, survey windows, regulatory compliance. Shows expired/critical/upcoming items with deadlines
- get_equipment_comparison → For comparing similar equipment (e.g., all separators, all pumps). Side-by-side health scores with best/worst performers
- get_cost_impact_estimate → For risk assessment of deferred maintenance, labor impact, budget planning. Scores items by safety/compliance/operational risk
- get_workload_forecast → For future workload prediction, capacity planning, bottleneck identification. Uses 6-month historical patterns

DATA TOOLS (use for specific queries):
- get_work_orders / get_overdue_work_orders / get_due_work_orders → Specific work order lists
- get_work_order_detail → Single work order deep dive
- get_work_order_counts → Quick status counts
- get_low_stock_spares / get_critical_spares → Spare inventory queries
- get_components → Component lookups
- get_running_hours → Running hours audit trail for specific components
- get_jobs → Job template queries
- get_stores_items → Stores/lubricants/chemicals inventory
- get_defects → Defect tracking and analysis
- get_consumption_analysis → Spares usage trends and ROB tracking
- get_maintenance_calendar → Scheduling and workload calendar views
- generate_deep_link → Navigation links ("show me", "take me to")

TOOL CHAINING:
- For complex queries, call multiple tools to build a complete picture
- Always combine analytical tools with data tools when deeper detail is needed
- After presenting analysis, offer to drill down into specific areas
- When user asks about running hours, use get_running_hours_analytics (not get_running_hours) for analytical insights
- When user asks about ROB or stock levels, use get_rob_analysis for analytical view, get_low_stock_spares for quick list

QUERY CLASSIFICATION & MULTI-TOOL CHAINS (CRITICAL — follow these patterns):

When user asks about PRIORITIES / WHAT TO DO / WHAT SHOULD I FOCUS ON:
→ Chain: get_overdue_work_orders + get_due_work_orders + get_compliance_alerts + get_spare_coverage_analysis
→ Synthesize into a numbered action plan with day-by-day timeline

When user asks about MAINTENANCE STATUS / OVERVIEW / HOW ARE WE DOING:
→ Chain: get_maintenance_insights + get_workload_analysis + get_performance_trends
→ Provide breakdown by department/priority/timeline with trend direction

When user asks about EQUIPMENT / COMPONENT HEALTH / RELIABILITY:
→ Chain: get_component_health_score + get_overdue_work_orders + get_defects
→ Identify correlations between defects and maintenance delays

When user asks about INVENTORY / SPARES / STOCK / PROCUREMENT:
→ Chain: get_spare_coverage_analysis + get_rob_analysis + get_consumption_analysis
→ Flag items blocking work orders and provide reorder recommendations

When user asks about SCHEDULING / PLANNING / WORKLOAD:
→ Chain: get_maintenance_planner + get_workload_forecast + get_due_work_orders
→ Show weekly breakdown with resource allocation suggestions

When user asks about COMPLIANCE / CERTIFICATES / SURVEYS:
→ Chain: get_compliance_alerts + get_maintenance_insights
→ Show expired/critical/upcoming items with deadlines and action items

When user asks AMBIGUOUS question (no timeframe, system, or scope specified):
→ Ask 1 clarifying question with 2-3 specific options
→ Suggest the most common/useful interpretation as a default

When user asks SIMPLE FACT (vessel count, single certificate date, specific work order):
→ Call single appropriate tool and answer directly
→ Offer related follow-up options

═══════ CLARIFYING QUESTIONS ═══════

When a query lacks specificity (no timeframe, system, or priority level), ask ONE clarifying question:
- Provide 2-3 specific options in the question
- Suggest the most common/useful interpretation as default
- Keep clarifying questions concise (2-3 sentences max)
- Do NOT ask clarifying questions for queries that clearly map to a specific tool or tool chain

Examples of ambiguous queries requiring clarification:
- "Show me defects" → Ask: time period? priority? system?
- "What should I do?" → Ask: timeframe (today/week/month)? department?
- "Check the pumps" → Ask: all pumps or specific type? health check or work orders?

Examples of clear queries that do NOT need clarification:
- "Show overdue work orders" → Just call get_overdue_work_orders
- "What should I prioritize this week?" → Chain tools and provide action plan
- "How many vessels?" → Call get_fleet_overview and answer

═══════ NATURAL LANGUAGE DATE HANDLING ═══════

Interpret relative dates based on current date (${new Date().toISOString().split("T")[0]}):
- "next week" = next 7 days from today
- "next month" = the calendar month after the current one
- "last quarter" = previous 3-month period
- "next 90 days" = 90 days from today
- "this year" = current calendar year
- "last 6 months" = 180 days before today

When no time period is specified, use these defaults:
- Upcoming/due items: next 30 days
- Trends and history: last 90 days
- Forecasting: next 3 months
- Recurring analysis: last 12 months

═══════ TONE & STYLE ═══════

- Speak like a senior technical superintendent — concise, data-driven, action-oriented
- Use maritime terminology naturally (Main Engine, Chief Engineer, ROB, running hours, dry dock)
- Crew are busy — get to the point fast, lead with what matters most
- Be direct about risks and concerns — don't soften critical findings
- When no data is found, explain what's missing and suggest alternative queries
- Never show empty tables — summarize with "No items found" and suggest what to check

═══════ EXAMPLE RESPONSES (Quality Benchmark) ═══════

EXAMPLE A — Weekly Prioritization (Multi-Tool Chain):
User: "What should I prioritize this week?"
[Calls: get_overdue_work_orders → get_due_work_orders → get_compliance_alerts → get_spare_coverage_analysis]

**📊 Summary**
You have 24 high-priority overdue tasks, 19 items due this week, 1 expired certificate, and 2 spare parts at zero stock blocking critical maintenance.

**⚠️ Critical Priorities (This Week)**
1. **IMMEDIATE (Today):** Renew expired Safety Equipment Certificate (expired 30 days ago) — port detention risk
2. **DAY 1-2:** Complete 5 overdue Main Engine inspections (999+ days overdue — critical safety risk)
3. **DAY 3:** Address 2 zero-stock spares (Rudders W/Nozzle, ME Turbochargers) — blocking 4 work orders
4. **DAY 4-5:** Complete 19 tasks due this week (2 high-priority, 9 medium, 8 low)

**✅ Recommendations**
1. **Contact surveyor immediately** — certificate renewal to avoid port detention
2. **Assign 2nd Engineer to Main Engine inspections** — Days 1-2 priority
3. **Order zero-stock spares today** — lead time may delay dependent work orders
4. **Monitor remaining 98 medium-priority overdue tasks** — escalation risk

**💡 Related Queries**
- "Give me a detailed work schedule breakdown"
- "Show spare parts procurement list for blocked work orders"

EXAMPLE B — Ambiguous Query (Ask Clarifying Question):
User: "Show me the defects"

I can help you with defect information. To provide the most relevant data, could you clarify:

1. **Time period:** Active defects only, or defects from last 30/60/90 days?
2. **Priority level:** All defects, or only high/critical priority?
3. **Specific system:** All systems, or a particular system (e.g., Main Engine, Auxiliary)?

Or I can show you **active defects by priority** (recommended) — just say the word.

EXAMPLE C — Simple Fleet Query (Direct Answer):
User: "How many vessels do we have?"
[Calls: get_fleet_overview]

**📊 Summary**
You manage 3 vessels in your fleet — all operational.

| # | Vessel | Status |
|---|--------|--------|
| 1 | MV Ocean Carrier | Active |
| 2 | MV Sea Explorer | Active |
| 3 | MV Pacific Star | Active |

Currently analyzing: ${context.vesselName}.

**💡 Related Queries**
- "Show maintenance overview for MV Ocean Carrier"
- "Which vessel has the most overdue work orders?"`;
}

const CHATBOT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_work_orders",
      description:
        "Get list of work orders with optional filters. Use this for queries about maintenance tasks, jobs, or work order lists.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          status: {
            type: "string",
            enum: [
              "Overdue",
              "Due",
              "Due (Grace P)",
              "Active",
              "Completed",
              "Postponed",
              "Pending Approval",
            ],
            description: "Filter by work order status",
          },
          componentCode: {
            type: "string",
            description: "Filter by component code",
          },
          dateRange: {
            type: "string",
            enum: ["week", "month", "quarter"],
            description: "Filter by date range from today",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 50)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_work_order_detail",
      description:
        "Get detailed information about a single work order by its ID or work order number.",
      parameters: {
        type: "object",
        properties: {
          workOrderId: {
            type: "string",
            description: "Work order ID or work order number",
          },
          vesselId: { type: "string", description: "Vessel ID" },
        },
        required: ["workOrderId", "vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_overdue_work_orders",
      description:
        "Get all overdue work orders for a vessel. Use when user asks about overdue maintenance.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 50)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_due_work_orders",
      description:
        "Get work orders that are currently due for a vessel. Optionally filter by date range.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          dateRange: {
            type: "string",
            enum: ["week", "month", "quarter"],
            description: "Filter by upcoming date range",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_work_order_counts",
      description:
        "Get count of work orders by status for dashboard summaries and KPI queries. Always call this first for summary questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_spares",
      description:
        "Get list of spare parts that are below minimum stock level. Critical for supply planning.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          criticalOnly: {
            type: "boolean",
            description: "Show only critical spares (default: false)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_critical_spares",
      description:
        "Get critical spare parts for a vessel, including their stock levels.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_components",
      description:
        "Get components list for a vessel. Can filter by critical status or search by name.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          critical: {
            type: "boolean",
            description: "Filter for critical components only",
          },
          search: {
            type: "string",
            description: "Search by component name or code",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_running_hours",
      description:
        "Get running hours audit history for a specific component.",
      parameters: {
        type: "object",
        properties: {
          componentId: {
            type: "string",
            description: "Component ID to get running hours for",
          },
          limit: {
            type: "number",
            description: "Maximum number of audit records (default: 10)",
          },
        },
        required: ["componentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_jobs",
      description:
        "Get maintenance job templates for a vessel, optionally filtered by component.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          componentId: {
            type: "string",
            description: "Filter by component ID",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_deep_link",
      description:
        "Generate a deep link URL to a specific filtered view in the PMS dashboard. Use when user asks to 'show me', 'take me to', or 'open'.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: [
              "work-orders",
              "components",
              "spares",
              "stores",
              "reports",
              "running-hours",
              "defects",
            ],
            description: "Target page",
          },
          filters: {
            type: "object",
            description:
              "Query parameters as key-value pairs (e.g., {status: 'overdue', vesselId: 'xxx'})",
          },
        },
        required: ["page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stores_items",
      description:
        "Get stores inventory including lubricants, chemicals, and general stores. Can filter for low stock, expiring items, and non-moving items.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          itemType: {
            type: "string",
            enum: ["stores", "lubricants", "chemicals", "others"],
            description: "Filter by item type category",
          },
          filter: {
            type: "string",
            enum: ["low_stock", "expiring_soon", "non_moving", "all"],
            description:
              "Filter preset: low_stock (ROB < minimum), expiring_soon (chemicals expiring within 90 days), non_moving (no transactions in 6+ months)",
          },
          search: {
            type: "string",
            description: "Search by item name or item code",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 50)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_defects",
      description:
        "Get defects list with filters. Supports active/resolved views, priority, category (Defect, COC, Observation, NCR), date ranges, risk level, and recurring defect analysis.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          statusView: {
            type: "string",
            enum: ["active", "resolved"],
            description: "View active (open) or resolved (closed) defects",
          },
          category: {
            type: "string",
            enum: ["Defect", "COC", "Observation", "NCR"],
            description: "Filter by defect category",
          },
          priority: {
            type: "string",
            enum: ["High", "Medium", "Low"],
            description: "Filter by priority level",
          },
          critical: {
            type: "boolean",
            description: "Filter for critical defects only",
          },
          dateRange: {
            type: "string",
            enum: ["week", "month", "quarter", "year"],
            description: "Filter by issue date range",
          },
          dueOverdue: {
            type: "string",
            enum: ["overdue", "due_this_week", "due_this_month"],
            description: "Filter by target close date status",
          },
          includeRecurring: {
            type: "boolean",
            description:
              "Also fetch recurring defect patterns (default: false)",
          },
          search: {
            type: "string",
            description: "Search by description or equipment",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 50)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_consumption_analysis",
      description:
        "Analyze spare parts consumption patterns including usage history, consumption trends, high-consumption items, and ROB (Remaining on Board) tracking. Use for supply chain planning and inventory optimization questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          analysisType: {
            type: "string",
            enum: [
              "high_consumption",
              "consumption_trend",
              "rob_status",
              "recent_activity",
            ],
            description:
              "Type of analysis: high_consumption (most consumed items), consumption_trend (usage over time), rob_status (current stock vs history), recent_activity (latest consume/receive events)",
          },
          periodMonths: {
            type: "number",
            description:
              "Analysis period in months (default: 6). Used for trend and high-consumption analysis.",
          },
          componentCode: {
            type: "string",
            description: "Filter by component code",
          },
          criticalOnly: {
            type: "boolean",
            description: "Analyze only critical spares (default: false)",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 30)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_maintenance_calendar",
      description:
        "Get maintenance calendar data showing upcoming jobs, workload distribution, and scheduled maintenance by date range. Use for planning, scheduling, and workload questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          dateRange: {
            type: "string",
            enum: ["week", "month", "quarter"],
            description:
              "Time horizon for calendar view (default: month)",
          },
          groupBy: {
            type: "string",
            enum: ["date", "component", "priority", "assignee", "department"],
            description:
              "How to group/aggregate the results (default: date)",
          },
          includeOverdue: {
            type: "boolean",
            description:
              "Include overdue items in the calendar view (default: true)",
          },
          maintenanceType: {
            type: "string",
            enum: ["Planned", "Unplanned", "Condition Based"],
            description: "Filter by maintenance type",
          },
          department: {
            type: "string",
            description: "Filter by department (e.g., Deck, Engine)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_maintenance_insights",
      description:
        "Get comprehensive maintenance KPIs and risk analysis. Returns overdue counts by priority, top components with most overdue work, compliance rate, critical items needing immediate attention, and trend indicators. Use this FIRST for any overview, status, or 'how are we doing' questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spare_coverage_analysis",
      description:
        "Analyze spare parts coverage and supply chain risk. Returns spares below minimum with urgency scoring, critical spares at risk, components affected by shortage, fast-moving consumption items, and reorder recommendations.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workload_analysis",
      description:
        "Analyze maintenance workload distribution and backlog. Returns due work this week by priority, overdue backlog aging (30/60/90+ days), workload by department, and scheduling priority recommendations.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_component_health_score",
      description:
        "Calculate component health risk scores combining defects, overdue maintenance, and running hours data. Returns top components needing attention with risk scoring, recurring defect patterns, and maintenance gap analysis.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          topN: {
            type: "number",
            description: "Number of top risk components to return (default: 10)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_performance_trends",
      description:
        "Analyze maintenance performance trends over time. Returns work order completion rates (30/60/90 days), average completion time by priority, spare consumption patterns, defect resolution metrics, and compliance trend direction.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          periodDays: {
            type: "number",
            description: "Analysis period in days (default: 90)",
          },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_running_hours_analytics",
      description: "Analyze running hours data for components. Returns current RH readings, accumulation over 30/60/90 days, components approaching RH-based maintenance thresholds, anomalies (unusual spikes or drops), and condition-based maintenance recommendations. Use for any running hours, engine hours, or equipment usage questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          componentFilter: { type: "string", description: "Optional component name/code filter (e.g., 'main engine', 'generator')" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_maintenance_planner",
      description: "Generate a maintenance planning view for a specified period. Shows work orders grouped by week/month, workload distribution by priority and department, critical path items that cannot be delayed, and resource allocation recommendations. Use for scheduling, planning, or workload distribution questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          periodDays: { type: "number", description: "Planning horizon in days (default: 90)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rob_analysis",
      description: "Analyze Remaining On Board (ROB) spare parts status. Returns items with zero stock, items below minimum levels, overstocked items (ROB exceeding max), estimated stockout dates based on consumption rate, and urgent procurement recommendations. Use for ROB, stock level, inventory, or procurement questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          includeOverstock: { type: "boolean", description: "Include overstocked items analysis (default: true)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_change_request_analysis",
      description: "Analyze PMS change requests status and workflow. Returns requests grouped by status (draft/submitted/approved/rejected/returned), aging of pending requests, changes by category and component type, approved changes impact summary, and workflow efficiency recommendations.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recurring_defect_analysis",
      description: "Analyze recurring defect patterns and failure trends. Returns components with repeat failures, mean time between failures (MTBF), Condition of Class items, vessels affected, correlation with maintenance gaps, and recommendations for preventive measures.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (optional - omit for fleet-wide view)" },
          windowMonths: { type: "number", description: "Analysis window in months (default: 12)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_compliance_alerts",
      description: "Check certificate and survey compliance status. Returns certificates expiring within specified period, overdue certifications, upcoming survey windows, regulatory compliance gaps, and action items with deadlines. Use for certification, survey, compliance, or regulatory questions.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          periodDays: { type: "number", description: "Look-ahead period in days (default: 90)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_equipment_comparison",
      description: "Compare health and performance across similar equipment types. Returns side-by-side comparison of components matching a filter, including overdue work counts, defect counts, running hours, and overall health scores. Identifies best/worst performers and outliers.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          equipmentFilter: { type: "string", description: "Equipment type to compare (e.g., 'fuel oil separator', 'generator', 'pump')" },
        },
        required: ["vesselId", "equipmentFilter"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cost_impact_estimate",
      description: "Estimate operational risk and resource impact of overdue/deferred maintenance. Returns risk-scored items by criticality and age, estimated labor hours for backlog clearance, spare parts required for overdue items, risk categories (safety/compliance/operational), and priority recommendations for budget allocation.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workload_forecast",
      description: "Forecast maintenance workload for the upcoming period based on historical patterns and scheduled jobs. Returns predicted due jobs by month, seasonal/cyclical patterns, resource requirement estimates, potential bottleneck periods, and proactive scheduling recommendations.",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID (required)" },
          forecastMonths: { type: "number", description: "Forecast horizon in months (default: 3)" },
        },
        required: ["vesselId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fleet_overview",
      description: "Get complete fleet information including vessel count, list of all vessels with their IDs, names, codes, and active status. Use this for questions like 'how many vessels', 'list all vessels', 'show fleet', 'which vessels are active', 'fleet overview', 'fleet summary'. No parameters needed since this returns fleet-wide data.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

async function executeTool(
  toolName: string,
  args: any,
  storage: IStorage
): Promise<any> {
  try {
    switch (toolName) {
      case "get_work_orders": {
        const workOrders = await storage.getWorkOrders(args.vesselId);
        let filtered = workOrders.filter(
          (wo) => wo.dataScope === "vessel"
        );

        if (args.status) {
          filtered = filtered.filter((wo) => wo.status === args.status);
        }

        if (args.componentCode) {
          filtered = filtered.filter((wo) =>
            wo.componentCode
              ?.toLowerCase()
              .includes(args.componentCode.toLowerCase())
          );
        }

        if (args.dateRange) {
          const now = new Date();
          const cutoffDate = new Date();
          if (args.dateRange === "week") cutoffDate.setDate(now.getDate() + 7);
          else if (args.dateRange === "month")
            cutoffDate.setDate(now.getDate() + 30);
          else if (args.dateRange === "quarter")
            cutoffDate.setDate(now.getDate() + 90);

          filtered = filtered.filter((wo) => {
            if (!wo.dueDate) return false;
            const dueDate = new Date(wo.dueDate);
            return dueDate <= cutoffDate;
          });
        }

        const limit = args.limit || 50;
        const results = filtered.slice(0, limit);
        return {
          count: filtered.length,
          showing: results.length,
          workOrders: results.map((wo) => ({
            id: wo.id,
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            componentCode: wo.componentCode,
            jobTitle: wo.jobTitle,
            status: wo.status,
            dueDate: wo.dueDate,
            assignedTo: wo.assignedTo,
            jobPriority: wo.jobPriority,
            maintenanceType: wo.maintenanceType,
          })),
        };
      }

      case "get_work_order_detail": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const wo = allWOs.find(
          (w) =>
            w.id === args.workOrderId ||
            w.workOrderNo === args.workOrderId
        );
        if (!wo)
          return { error: `Work order '${args.workOrderId}' not found` };
        return {
          id: wo.id,
          workOrderNo: wo.workOrderNo,
          component: wo.component,
          componentCode: wo.componentCode,
          jobTitle: wo.jobTitle,
          status: wo.status,
          dueDate: wo.dueDate,
          assignedTo: wo.assignedTo,
          jobPriority: wo.jobPriority,
          maintenanceType: wo.maintenanceType,
          maintenanceBasis: wo.maintenanceBasis,
          frequencyValue: wo.frequencyValue,
          frequencyUnit: wo.frequencyUnit,
          dateCompleted: wo.dateCompleted,
          briefWorkDescription: wo.briefWorkDescription,
          workCarriedOut: wo.workCarriedOut,
          remarks: wo.remarks,
          runningHours: wo.runningHours,
        };
      }

      case "get_overdue_work_orders": {
        const workOrders = await storage.getWorkOrders(args.vesselId);
        const overdue = workOrders.filter(
          (wo) => wo.status === "Overdue" && wo.dataScope === "vessel"
        );
        const now = new Date();

        const byPriority = {
          Critical: overdue.filter((wo) => wo.jobPriority === "Critical").length,
          High: overdue.filter((wo) => wo.jobPriority === "High").length,
          Medium: overdue.filter((wo) => wo.jobPriority === "Medium").length,
          Low: overdue.filter((wo) => wo.jobPriority === "Low" || !wo.jobPriority).length,
        };

        const componentCounts = new Map<string, number>();
        for (const wo of overdue) {
          const comp = wo.component || "Unknown";
          componentCounts.set(comp, (componentCounts.get(comp) || 0) + 1);
        }
        const topComponents = Array.from(componentCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([component, count]) => ({ component, count }));

        const agingDays = overdue.map((wo) => {
          if (!wo.dueDate) return 0;
          return Math.max(0, Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
        });
        const oldestDays = agingDays.length > 0 ? Math.max(...agingDays) : 0;

        const sorted = overdue
          .map((wo) => ({
            id: wo.id,
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            componentCode: wo.componentCode,
            jobTitle: wo.jobTitle,
            dueDate: wo.dueDate,
            assignedTo: wo.assignedTo,
            jobPriority: wo.jobPriority,
            daysOverdue: wo.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0,
          }))
          .sort((a, b) => {
            const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
            const pa = priorityOrder[a.jobPriority || "Low"] ?? 3;
            const pb = priorityOrder[b.jobPriority || "Low"] ?? 3;
            if (pa !== pb) return pa - pb;
            return b.daysOverdue - a.daysOverdue;
          });

        const limit = Math.min(args.limit || 10, 10);
        return {
          totalOverdue: overdue.length,
          showing: Math.min(limit, sorted.length),
          remainingSummary: sorted.length > limit ? `...and ${sorted.length - limit} more overdue items` : null,
          analysisSummary: {
            byPriority,
            topComponents,
            oldestOverdueDays: oldestDays,
            averageOverdueDays: agingDays.length > 0 ? Math.round(agingDays.reduce((a, b) => a + b, 0) / agingDays.length) : 0,
          },
          workOrders: sorted.slice(0, limit),
        };
      }

      case "get_due_work_orders": {
        const workOrders = await storage.getWorkOrders(args.vesselId);
        let due = workOrders.filter(
          (wo) =>
            (wo.status === "Due" || wo.status === "Due (Grace P)") &&
            wo.dataScope === "vessel"
        );

        if (args.dateRange) {
          const now = new Date();
          const cutoffDate = new Date();
          if (args.dateRange === "week") cutoffDate.setDate(now.getDate() + 7);
          else if (args.dateRange === "month")
            cutoffDate.setDate(now.getDate() + 30);
          else if (args.dateRange === "quarter")
            cutoffDate.setDate(now.getDate() + 90);

          due = due.filter((wo) => {
            if (!wo.dueDate) return false;
            const dueDate = new Date(wo.dueDate);
            return dueDate <= cutoffDate;
          });
        }

        return {
          totalDue: due.length,
          workOrders: due.slice(0, 50).map((wo) => ({
            id: wo.id,
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            componentCode: wo.componentCode,
            jobTitle: wo.jobTitle,
            dueDate: wo.dueDate,
            assignedTo: wo.assignedTo,
            jobPriority: wo.jobPriority,
          })),
        };
      }

      case "get_work_order_counts": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const overdueCount = vesselWOs.filter((wo) => wo.status === "Overdue").length;
        const dueCount = vesselWOs.filter((wo) => wo.status === "Due" || wo.status === "Due (Grace P)").length;
        const completedCount = vesselWOs.filter((wo) => wo.status === "Completed").length;
        const activeCount = vesselWOs.filter((wo) => wo.status === "Active").length;
        const postponedCount = vesselWOs.filter((wo) => wo.status === "Postponed").length;
        const pendingCount = vesselWOs.filter((wo) => wo.status === "Pending Approval").length;
        const totalActionable = overdueCount + dueCount + completedCount;
        const completionRate = totalActionable > 0 ? Math.round((completedCount / totalActionable) * 100) : 0;
        const overdueRate = vesselWOs.length > 0 ? Math.round((overdueCount / vesselWOs.length) * 100) : 0;

        return {
          total: vesselWOs.length,
          overdue: overdueCount,
          overduePercent: overdueRate,
          due: dueCount,
          completed: completedCount,
          completionRate,
          pendingApproval: pendingCount,
          active: activeCount,
          postponed: postponedCount,
          insight: overdueRate > 20 ? "HIGH_OVERDUE_RATE" : overdueRate > 10 ? "ELEVATED_OVERDUE_RATE" : "NORMAL",
        };
      }

      case "get_low_stock_spares": {
        const spares = await storage.getSpares(args.vesselId);
        const activeSpares = spares.filter((sp) => !sp.deleted);
        let lowStock = activeSpares.filter(
          (sp) => sp.rob !== null && sp.min !== null && sp.rob < sp.min
        );

        if (args.criticalOnly) {
          lowStock = lowStock.filter(
            (sp) => sp.critical === "Critical" || sp.critical === "Yes"
          );
        }

        const criticalLow = lowStock.filter((sp) => sp.critical === "Critical" || sp.critical === "Yes");
        const nonCriticalLow = lowStock.length - criticalLow.length;
        const zeroStock = lowStock.filter((sp) => (sp.rob ?? 0) === 0);

        const sorted = lowStock
          .map((sp) => ({
            id: sp.id,
            partCode: sp.partCode,
            partName: sp.partName,
            componentName: sp.componentName,
            componentCode: sp.componentCode,
            rob: sp.rob,
            min: sp.min,
            shortfall: (sp.min ?? 0) - (sp.rob ?? 0),
            critical: sp.critical,
            location: sp.location,
            urgencyScore: (sp.critical === "Critical" || sp.critical === "Yes" ? 100 : 0) + ((sp.min ?? 0) - (sp.rob ?? 0)) * 2 + ((sp.rob ?? 0) === 0 ? 50 : 0),
          }))
          .sort((a, b) => b.urgencyScore - a.urgencyScore);

        return {
          totalLowStock: lowStock.length,
          totalActiveSpares: activeSpares.length,
          lowStockPercent: Math.round((lowStock.length / Math.max(activeSpares.length, 1)) * 100),
          analysisSummary: {
            criticalLowStock: criticalLow.length,
            nonCriticalLowStock: nonCriticalLow,
            zeroStockItems: zeroStock.length,
          },
          showing: Math.min(10, sorted.length),
          remainingSummary: sorted.length > 10 ? `...and ${sorted.length - 10} more low stock items` : null,
          topUrgentSpares: sorted.slice(0, 10).map(({ urgencyScore, ...rest }) => rest),
        };
      }

      case "get_critical_spares": {
        const spares = await storage.getSpares(args.vesselId);
        const critical = spares.filter(
          (sp) =>
            (sp.critical === "Critical" || sp.critical === "Yes") && !sp.deleted
        );
        return {
          totalCritical: critical.length,
          lowStockCritical: critical.filter(
            (sp) => sp.rob !== null && sp.min !== null && sp.rob < sp.min
          ).length,
          spares: critical.slice(0, 50).map((sp) => ({
            id: sp.id,
            partCode: sp.partCode,
            partName: sp.partName,
            componentName: sp.componentName,
            rob: sp.rob,
            min: sp.min,
            location: sp.location,
          })),
        };
      }

      case "get_components": {
        const components = await storage.getComponents(args.vesselId);
        let filtered = components.filter((c) => c.dataScope === "vessel");

        if (args.critical) {
          filtered = filtered.filter((c) => c.critical === true);
        }

        if (args.search) {
          const search = args.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.name?.toLowerCase().includes(search) ||
              c.componentCode?.toLowerCase().includes(search) ||
              c.fleetEquipmentName?.toLowerCase().includes(search)
          );
        }

        return {
          totalComponents: filtered.length,
          components: filtered.slice(0, 50).map((c) => ({
            id: c.id,
            componentCode: c.componentCode,
            name: c.name,
            fleetEquipmentName: c.fleetEquipmentName,
            critical: c.critical,
            department: c.department,
            maker: c.maker,
            model: c.model,
            runningHours: c.currentCumulativeRH,
            rhCounterType: c.rhCounterType,
            isActive: c.isActive,
          })),
        };
      }

      case "get_running_hours": {
        const limit = args.limit || 10;
        const audits = await storage.getRunningHoursAudits(
          args.componentId,
          limit
        );
        return {
          componentId: args.componentId,
          totalRecords: audits.length,
          audits: audits.map((a) => ({
            id: a.id,
            previousRH: a.previousRH,
            newRH: a.newRH,
            cumulativeRH: a.cumulativeRH,
            source: a.source,
            userId: a.userId,
            dateUpdatedLocal: a.dateUpdatedLocal,
          })),
        };
      }

      case "get_jobs": {
        const jobs = await storage.getJobs(args.vesselId, args.componentId);
        const vesselJobs = jobs.filter((j) => j.dataScope === "vessel");
        return {
          totalJobs: vesselJobs.length,
          jobs: vesselJobs.slice(0, 50).map((j) => ({
            id: j.id,
            jobNo: j.jobNo,
            jobTitle: j.jobTitle,
            componentCode: j.componentCode,
            componentName: j.componentName,
            maintenanceType: j.maintenanceType,
            maintenanceBasis: j.maintenanceBasis,
            frequencyValue: j.frequencyValue,
            frequencyUnit: j.frequencyUnit,
            nextDueDate: j.nextDueDate,
            lastDoneDate: j.lastDoneDate,
            jobPriority: j.jobPriority,
            assignedTo: j.assignedTo,
          })),
        };
      }

      case "get_stores_items": {
        const items = await storage.getStoresItems(
          args.vesselId,
          args.itemType
        );
        let filtered = items.filter((item) => item.isActive !== false && !item.deleted);

        if (args.search) {
          const search = args.search.toLowerCase();
          filtered = filtered.filter(
            (item) =>
              item.itemName?.toLowerCase().includes(search) ||
              item.itemCode?.toLowerCase().includes(search)
          );
        }

        if (args.filter === "low_stock") {
          filtered = filtered.filter((item) => {
            const rob = Number(item.rob) || 0;
            const min = Number(item.min) || 0;
            return min > 0 && rob < min;
          });
        } else if (args.filter === "expiring_soon") {
          const now = new Date();
          const cutoff = new Date();
          cutoff.setDate(now.getDate() + 90);
          filtered = filtered.filter((item) => {
            if (!item.expiryDate) return false;
            const expiry = new Date(item.expiryDate);
            return expiry <= cutoff && expiry >= now;
          });
        } else if (args.filter === "non_moving") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          filtered = filtered.filter((item) => {
            if (!item.updatedAt) return true;
            return new Date(item.updatedAt) < sixMonthsAgo;
          });
        }

        const limit = args.limit || 50;
        const results = filtered.slice(0, limit);

        const summary = {
          totalItems: filtered.length,
          byType: {
            stores: filtered.filter((i) => i.itemType === "stores").length,
            lubricants: filtered.filter((i) => i.itemType === "lubricants").length,
            chemicals: filtered.filter((i) => i.itemType === "chemicals").length,
            others: filtered.filter((i) => i.itemType === "others").length,
          },
          lowStockCount: filtered.filter((i) => {
            const rob = Number(i.rob) || 0;
            const min = Number(i.min) || 0;
            return min > 0 && rob < min;
          }).length,
        };

        return {
          summary,
          showing: results.length,
          items: results.map((item) => ({
            id: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemType: item.itemType,
            category: item.category,
            uom: item.uom,
            rob: item.rob,
            min: item.min,
            max: item.max,
            locationA: item.locationA,
            locationB: item.locationB,
            robLocationA: item.robLocationA,
            robLocationB: item.robLocationB,
            expiryDate: item.expiryDate,
            batchNumber: item.batchNumber,
            hazardClassification: item.hazardClassification,
            supplier: item.supplier,
            unitCost: item.unitCost,
          })),
        };
      }

      case "get_defects": {
        const defects = await storage.getDefects({
          vesselId: args.vesselId,
          statusView: args.statusView,
          category: args.category,
          critical: args.critical,
          search: args.search,
          dueOverdue: args.dueOverdue,
          includeClosedDefects: args.statusView === "resolved",
        });

        let filtered = defects;

        if (args.priority) {
          filtered = filtered.filter((d) => d.priority === args.priority);
        }

        if (args.dateRange) {
          const now = new Date();
          const cutoffDate = new Date();
          if (args.dateRange === "week") cutoffDate.setDate(now.getDate() - 7);
          else if (args.dateRange === "month") cutoffDate.setMonth(now.getMonth() - 1);
          else if (args.dateRange === "quarter") cutoffDate.setMonth(now.getMonth() - 3);
          else if (args.dateRange === "year") cutoffDate.setFullYear(now.getFullYear() - 1);

          filtered = filtered.filter((d) => {
            if (!d.issueDate) return false;
            return new Date(d.issueDate) >= cutoffDate;
          });
        }

        const limit = args.limit || 50;
        const results = filtered.slice(0, limit);

        const summary = {
          totalDefects: filtered.length,
          byCategory: {
            Defect: filtered.filter((d) => d.category === "Defect").length,
            COC: filtered.filter((d) => d.category === "COC").length,
            Observation: filtered.filter((d) => d.category === "Observation").length,
            NCR: filtered.filter((d) => d.category === "NCR").length,
          },
          byPriority: {
            High: filtered.filter((d) => d.priority === "High").length,
            Medium: filtered.filter((d) => d.priority === "Medium").length,
            Low: filtered.filter((d) => d.priority === "Low").length,
          },
          criticalCount: filtered.filter((d) => d.critical === true || d.is_coc === true).length,
          overdueCount: filtered.filter((d) => {
            if (!d.targetCloseDate || d.status === "Closed") return false;
            return new Date(d.targetCloseDate) < new Date();
          }).length,
        };

        let recurringData = null;
        if (args.includeRecurring) {
          try {
            const recurring = await storage.getRecurringDefects({});
            recurringData = {
              totalRecurring: recurring.length,
              patterns: recurring.slice(0, 10).map((r) => ({
                id: r.id,
                equipmentKey: r.equipmentKey,
                occurrenceCount: r.occurrenceCount,
                lastOccurrenceDate: r.lastOccurrenceDate,
                hasCoc: r.hasCoc,
                openCount: r.openCount,
                vesselsAffected: r.vesselsAffected,
                mtbfDays: r.mtbfDays,
              })),
            };
          } catch {
            recurringData = { error: "Unable to fetch recurring defects" };
          }
        }

        return {
          summary,
          showing: results.length,
          recurringDefects: recurringData,
          defects: results.map((d) => ({
            id: d.id,
            issueDate: d.issueDate,
            category: d.category,
            defectType: d.defectType,
            description: d.description?.substring(0, 200),
            status: d.status,
            priority: d.priority,
            critical: d.critical,
            is_coc: d.is_coc,
            severity: d.severity,
            targetCloseDate: d.targetCloseDate,
            dateCompleted: d.dateCompleted,
            equipmentCategory: d.equipmentCategory,
            equipmentType: d.equipmentType,
            riskLevel: d.riskLevel,
            assignedTo: d.assignedTo,
            raisedByName: d.raisedByName,
            source: d.source,
          })),
        };
      }

      case "get_consumption_analysis": {
        const history = await storage.getSpareHistory(args.vesselId);
        const spares = await storage.getSpares(args.vesselId);
        const activeSpares = spares.filter((sp) => !sp.deleted);

        const periodMonths = args.periodMonths || 6;
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);

        const recentHistory = history.filter((h) => {
          if (!h.timestampUTC) return false;
          return new Date(h.timestampUTC) >= cutoffDate;
        });

        let filteredHistory = recentHistory;
        if (args.componentCode) {
          const code = args.componentCode.toLowerCase();
          filteredHistory = filteredHistory.filter(
            (h) => h.componentCode?.toLowerCase().includes(code)
          );
        }

        const consumeEvents = filteredHistory.filter(
          (h) => h.eventType === "CONSUME"
        );
        const receiveEvents = filteredHistory.filter(
          (h) => h.eventType === "RECEIVE"
        );

        const limit = args.limit || 30;
        const analysisType = args.analysisType || "high_consumption";

        if (analysisType === "high_consumption") {
          const consumptionMap = new Map<
            number,
            { spareId: number; partCode: string; partName: string; componentName: string; totalConsumed: number; eventCount: number }
          >();

          for (const event of consumeEvents) {
            const existing = consumptionMap.get(event.spareId);
            const qty = Math.abs(event.qtyChange || 0);
            if (existing) {
              existing.totalConsumed += qty;
              existing.eventCount++;
            } else {
              consumptionMap.set(event.spareId, {
                spareId: event.spareId,
                partCode: event.partCode,
                partName: event.partName,
                componentName: event.componentName,
                totalConsumed: qty,
                eventCount: 1,
              });
            }
          }

          const sorted = Array.from(consumptionMap.values())
            .sort((a, b) => b.totalConsumed - a.totalConsumed)
            .slice(0, limit);

          if (args.criticalOnly) {
            const criticalIds = new Set(
              activeSpares
                .filter((sp) => sp.critical === "Critical" || sp.critical === "Yes")
                .map((sp) => sp.id)
            );
            return {
              periodMonths,
              totalConsumeEvents: consumeEvents.length,
              highConsumptionItems: sorted
                .filter((item) => criticalIds.has(item.spareId))
                .map((item) => {
                  const spare = activeSpares.find((sp) => sp.id === item.spareId);
                  return { ...item, currentRob: spare?.rob, minStock: spare?.min, critical: spare?.critical };
                }),
            };
          }

          return {
            periodMonths,
            totalConsumeEvents: consumeEvents.length,
            totalReceiveEvents: receiveEvents.length,
            highConsumptionItems: sorted.map((item) => {
              const spare = activeSpares.find((sp) => sp.id === item.spareId);
              return { ...item, currentRob: spare?.rob, minStock: spare?.min, critical: spare?.critical };
            }),
          };
        }

        if (analysisType === "consumption_trend") {
          const monthlyData = new Map<string, { consumed: number; received: number; events: number }>();
          for (const event of filteredHistory) {
            if (event.eventType !== "CONSUME" && event.eventType !== "RECEIVE") continue;
            const date = new Date(event.timestampUTC!);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const existing = monthlyData.get(monthKey) || { consumed: 0, received: 0, events: 0 };
            if (event.eventType === "CONSUME") existing.consumed += Math.abs(event.qtyChange || 0);
            else existing.received += Math.abs(event.qtyChange || 0);
            existing.events++;
            monthlyData.set(monthKey, existing);
          }

          const trendData = Array.from(monthlyData.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({ month, ...data }));

          return {
            periodMonths,
            trend: trendData,
            totalConsumed: trendData.reduce((sum, d) => sum + d.consumed, 0),
            totalReceived: trendData.reduce((sum, d) => sum + d.received, 0),
            averageMonthlyConsumption:
              trendData.length > 0
                ? Math.round(trendData.reduce((sum, d) => sum + d.consumed, 0) / trendData.length)
                : 0,
          };
        }

        if (analysisType === "rob_status") {
          const lowStockSpares = activeSpares.filter((sp) => {
            const rob = sp.rob ?? 0;
            const min = sp.min ?? 0;
            return min > 0 && rob < min;
          });

          const zeroStockSpares = activeSpares.filter(
            (sp) => (sp.rob ?? 0) === 0
          );

          return {
            totalActiveSpares: activeSpares.length,
            lowStockCount: lowStockSpares.length,
            zeroStockCount: zeroStockSpares.length,
            lowStockItems: lowStockSpares.slice(0, limit).map((sp) => ({
              id: sp.id,
              partCode: sp.partCode,
              partName: sp.partName,
              componentName: sp.componentName,
              rob: sp.rob,
              min: sp.min,
              critical: sp.critical,
              shortfall: (sp.min ?? 0) - (sp.rob ?? 0),
            })),
          };
        }

        if (analysisType === "recent_activity") {
          const recent = filteredHistory
            .filter((h) => h.eventType === "CONSUME" || h.eventType === "RECEIVE")
            .sort((a, b) => new Date(b.timestampUTC!).getTime() - new Date(a.timestampUTC!).getTime())
            .slice(0, limit);

          return {
            periodMonths,
            totalEvents: recent.length,
            events: recent.map((h) => ({
              id: h.id,
              date: h.timestampUTC,
              eventType: h.eventType,
              partCode: h.partCode,
              partName: h.partName,
              componentName: h.componentName,
              qtyChange: h.qtyChange,
              robAfter: h.robAfter,
              remarks: h.remarks,
              userId: h.userId,
            })),
          };
        }

        return { error: `Unknown analysis type: ${analysisType}` };
      }

      case "get_maintenance_calendar": {
        const workOrders = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = workOrders.filter((wo) => wo.dataScope === "vessel");

        const now = new Date();
        const rangeEnd = new Date();
        const dateRange = args.dateRange || "month";
        if (dateRange === "week") rangeEnd.setDate(now.getDate() + 7);
        else if (dateRange === "month") rangeEnd.setDate(now.getDate() + 30);
        else if (dateRange === "quarter") rangeEnd.setDate(now.getDate() + 90);

        let upcoming = vesselWOs.filter((wo) => {
          if (!wo.dueDate) return false;
          if (wo.status === "Completed") return false;
          const dueDate = new Date(wo.dueDate);
          return dueDate >= now && dueDate <= rangeEnd;
        });

        if (args.maintenanceType) {
          upcoming = upcoming.filter(
            (wo) => wo.maintenanceType === args.maintenanceType
          );
        }
        if (args.department) {
          const dept = args.department.toLowerCase();
          upcoming = upcoming.filter(
            (wo) => wo.department?.toLowerCase().includes(dept)
          );
        }

        let overdueItems: any[] = [];
        if (args.includeOverdue !== false) {
          overdueItems = vesselWOs
            .filter((wo) => wo.status === "Overdue")
            .map((wo) => ({
              id: wo.id,
              workOrderNo: wo.workOrderNo,
              component: wo.component,
              componentCode: wo.componentCode,
              jobTitle: wo.jobTitle,
              dueDate: wo.dueDate,
              assignedTo: wo.assignedTo,
              jobPriority: wo.jobPriority,
              status: "Overdue",
            }));
        }

        const groupBy = args.groupBy || "date";
        let groupedData: any = {};

        if (groupBy === "date") {
          const byDate = new Map<string, any[]>();
          for (const wo of upcoming) {
            const dateKey = wo.dueDate?.split("T")[0] || "Unknown";
            if (!byDate.has(dateKey)) byDate.set(dateKey, []);
            byDate.get(dateKey)!.push({
              id: wo.id,
              workOrderNo: wo.workOrderNo,
              component: wo.component,
              jobTitle: wo.jobTitle,
              assignedTo: wo.assignedTo,
              jobPriority: wo.jobPriority,
              maintenanceType: wo.maintenanceType,
            });
          }
          groupedData = Object.fromEntries(
            Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))
          );
        } else if (groupBy === "component") {
          const byComp = new Map<string, any[]>();
          for (const wo of upcoming) {
            const key = wo.component || "Unknown";
            if (!byComp.has(key)) byComp.set(key, []);
            byComp.get(key)!.push({
              id: wo.id,
              workOrderNo: wo.workOrderNo,
              jobTitle: wo.jobTitle,
              dueDate: wo.dueDate,
              jobPriority: wo.jobPriority,
            });
          }
          groupedData = Object.fromEntries(byComp);
        } else if (groupBy === "priority") {
          const byPriority = new Map<string, number>();
          for (const wo of upcoming) {
            const key = wo.jobPriority || "Unassigned";
            byPriority.set(key, (byPriority.get(key) || 0) + 1);
          }
          groupedData = Object.fromEntries(byPriority);
        } else if (groupBy === "assignee") {
          const byAssignee = new Map<string, number>();
          for (const wo of upcoming) {
            const key = wo.assignedTo || "Unassigned";
            byAssignee.set(key, (byAssignee.get(key) || 0) + 1);
          }
          groupedData = Object.fromEntries(byAssignee);
        } else if (groupBy === "department") {
          const byDept = new Map<string, number>();
          for (const wo of upcoming) {
            const key = wo.department || "Unknown";
            byDept.set(key, (byDept.get(key) || 0) + 1);
          }
          groupedData = Object.fromEntries(byDept);
        }

        return {
          dateRange,
          rangeStart: now.toISOString().split("T")[0],
          rangeEnd: rangeEnd.toISOString().split("T")[0],
          totalUpcoming: upcoming.length,
          overdueCount: overdueItems.length,
          groupedBy: groupBy,
          data: groupedData,
          overdueItems: overdueItems.slice(0, 20),
          workloadSummary: {
            totalPlanned: upcoming.length,
            highPriority: upcoming.filter(
              (wo) =>
                wo.jobPriority === "Critical" || wo.jobPriority === "High"
            ).length,
            mediumPriority: upcoming.filter(
              (wo) => wo.jobPriority === "Medium"
            ).length,
            lowPriority: upcoming.filter(
              (wo) =>
                wo.jobPriority === "Low" || !wo.jobPriority
            ).length,
          },
        };
      }

      case "generate_deep_link": {
        const pageMap: Record<string, string> = {
          "work-orders": "/pms/work-orders",
          components: "/pms/components",
          spares: "/spares",
          stores: "/stores",
          reports: "/reports",
          "running-hours": "/pms/running-hours",
          defects: "/defects",
        };
        const basePath = pageMap[args.page] || "/pms";
        const queryParams = args.filters
          ? new URLSearchParams(args.filters).toString()
          : "";
        return {
          url: `${basePath}${queryParams ? "?" + queryParams : ""}`,
          displayText: `View ${args.page.replace(/-/g, " ")}`,
        };
      }

      case "get_maintenance_insights": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const now = new Date();

        const overdue = vesselWOs.filter((wo) => wo.status === "Overdue");
        const due = vesselWOs.filter((wo) => wo.status === "Due" || wo.status === "Due (Grace P)");
        const completed = vesselWOs.filter((wo) => wo.status === "Completed");
        const active = vesselWOs.filter((wo) => wo.status === "Active");
        const postponed = vesselWOs.filter((wo) => wo.status === "Postponed");

        const overdueByPriority = {
          Critical: overdue.filter((wo) => wo.jobPriority === "Critical").length,
          High: overdue.filter((wo) => wo.jobPriority === "High").length,
          Medium: overdue.filter((wo) => wo.jobPriority === "Medium").length,
          Low: overdue.filter((wo) => wo.jobPriority === "Low" || !wo.jobPriority).length,
        };

        const componentOverdueMap = new Map<string, number>();
        for (const wo of overdue) {
          const comp = wo.component || "Unknown";
          componentOverdueMap.set(comp, (componentOverdueMap.get(comp) || 0) + 1);
        }
        const topOverdueComponents = Array.from(componentOverdueMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([component, count]) => ({ component, overdueCount: count, percentOfTotal: Math.round((count / Math.max(overdue.length, 1)) * 100) }));

        const totalNonActive = completed.length + overdue.length + due.length;
        const complianceRate = totalNonActive > 0 ? Math.round((completed.length / totalNonActive) * 100) : 0;

        const overdueAging = overdue.map((wo) => {
          const dueDate = wo.dueDate ? new Date(wo.dueDate) : now;
          return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        });
        const oldestOverdueDays = overdueAging.length > 0 ? Math.max(...overdueAging) : 0;
        const avgOverdueDays = overdueAging.length > 0 ? Math.round(overdueAging.reduce((a, b) => a + b, 0) / overdueAging.length) : 0;

        const criticalItems = overdue
          .filter((wo) => wo.jobPriority === "Critical" || wo.jobPriority === "High")
          .sort((a, b) => {
            const aDays = a.dueDate ? Math.floor((now.getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const bDays = b.dueDate ? Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            return bDays - aDays;
          })
          .slice(0, 10)
          .map((wo) => ({
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            jobTitle: wo.jobTitle,
            priority: wo.jobPriority,
            daysOverdue: wo.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0,
            assignedTo: wo.assignedTo,
          }));

        return {
          totalWorkOrders: vesselWOs.length,
          statusBreakdown: {
            overdue: overdue.length,
            overduePercent: Math.round((overdue.length / Math.max(vesselWOs.length, 1)) * 100),
            due: due.length,
            completed: completed.length,
            active: active.length,
            postponed: postponed.length,
          },
          overdueByPriority,
          topOverdueComponents,
          complianceRate,
          overdueAging: {
            oldestDays: oldestOverdueDays,
            averageDays: avgOverdueDays,
            over30Days: overdueAging.filter((d) => d > 30).length,
            over60Days: overdueAging.filter((d) => d > 60).length,
            over90Days: overdueAging.filter((d) => d > 90).length,
          },
          criticalItemsNeedingAttention: criticalItems,
        };
      }

      case "get_spare_coverage_analysis": {
        const spares = await storage.getSpares(args.vesselId);
        const activeSpares = spares.filter((sp) => !sp.deleted);
        const history = await storage.getSpareHistory(args.vesselId);

        const belowMin = activeSpares.filter((sp) => sp.rob !== null && sp.min !== null && sp.rob < sp.min);
        const criticalBelowMin = belowMin.filter((sp) => sp.critical === "Critical" || sp.critical === "Yes");
        const zeroStock = activeSpares.filter((sp) => (sp.rob ?? 0) === 0);

        const componentAtRisk = new Map<string, number>();
        for (const sp of belowMin) {
          const comp = sp.componentName || "Unknown";
          componentAtRisk.set(comp, (componentAtRisk.get(comp) || 0) + 1);
        }
        const componentsAffected = Array.from(componentAtRisk.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([component, shortageCount]) => ({ component, shortageCount }));

        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        const recentConsume = history.filter((h) => h.eventType === "CONSUME" && h.timestampUTC && new Date(h.timestampUTC) >= sixMonthsAgo);

        const consumeBySpare = new Map<number, { partCode: string; partName: string; totalConsumed: number; eventCount: number }>();
        for (const event of recentConsume) {
          const existing = consumeBySpare.get(event.spareId);
          const qty = Math.abs(event.qtyChange || 0);
          if (existing) {
            existing.totalConsumed += qty;
            existing.eventCount++;
          } else {
            consumeBySpare.set(event.spareId, {
              partCode: event.partCode,
              partName: event.partName,
              totalConsumed: qty,
              eventCount: 1,
            });
          }
        }
        const fastMoving = Array.from(consumeBySpare.entries())
          .sort((a, b) => b[1].totalConsumed - a[1].totalConsumed)
          .slice(0, 10)
          .map(([spareId, data]) => {
            const spare = activeSpares.find((sp) => sp.id === spareId);
            const monthlyRate = data.totalConsumed / 6;
            const currentRob = spare?.rob ?? 0;
            const estimatedMonthsUntilStockout = monthlyRate > 0 ? Math.round((currentRob / monthlyRate) * 10) / 10 : null;
            return {
              ...data,
              currentRob,
              minStock: spare?.min,
              critical: spare?.critical,
              monthlyConsumptionRate: Math.round(monthlyRate * 10) / 10,
              estimatedMonthsUntilStockout,
            };
          });

        const urgentReorders = belowMin
          .map((sp) => {
            const shortfall = (sp.min ?? 0) - (sp.rob ?? 0);
            const consumeData = consumeBySpare.get(sp.id);
            const monthlyRate = consumeData ? consumeData.totalConsumed / 6 : 0;
            const daysUntilStockout = monthlyRate > 0 && sp.rob !== null ? Math.round(((sp.rob ?? 0) / monthlyRate) * 30) : null;
            return {
              partCode: sp.partCode,
              partName: sp.partName,
              componentName: sp.componentName,
              rob: sp.rob,
              min: sp.min,
              shortfall,
              critical: sp.critical,
              daysUntilStockout,
              urgencyScore: (sp.critical === "Critical" || sp.critical === "Yes" ? 100 : 0) + shortfall * 2 + (daysUntilStockout !== null && daysUntilStockout < 30 ? 50 : 0),
            };
          })
          .sort((a, b) => b.urgencyScore - a.urgencyScore)
          .slice(0, 15);

        return {
          totalActiveSpares: activeSpares.length,
          belowMinimumCount: belowMin.length,
          belowMinimumPercent: Math.round((belowMin.length / Math.max(activeSpares.length, 1)) * 100),
          criticalBelowMinCount: criticalBelowMin.length,
          zeroStockCount: zeroStock.length,
          componentsAffectedByShortage: componentsAffected,
          fastMovingItems: fastMoving,
          urgentReorderList: urgentReorders,
        };
      }

      case "get_workload_analysis": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const now = new Date();

        const overdue = vesselWOs.filter((wo) => wo.status === "Overdue");
        const dueWOs = vesselWOs.filter((wo) => wo.status === "Due" || wo.status === "Due (Grace P)");

        const oneWeek = new Date();
        oneWeek.setDate(now.getDate() + 7);
        const dueThisWeek = dueWOs.filter((wo) => wo.dueDate && new Date(wo.dueDate) <= oneWeek);
        const dueThisWeekByPriority = {
          Critical: dueThisWeek.filter((wo) => wo.jobPriority === "Critical").length,
          High: dueThisWeek.filter((wo) => wo.jobPriority === "High").length,
          Medium: dueThisWeek.filter((wo) => wo.jobPriority === "Medium").length,
          Low: dueThisWeek.filter((wo) => wo.jobPriority === "Low" || !wo.jobPriority).length,
        };

        const overdueAging = overdue.map((wo) => {
          const dueDate = wo.dueDate ? new Date(wo.dueDate) : now;
          return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        });

        const agingBuckets = {
          under30Days: overdueAging.filter((d) => d < 30).length,
          days30to60: overdueAging.filter((d) => d >= 30 && d < 60).length,
          days60to90: overdueAging.filter((d) => d >= 60 && d < 90).length,
          over90Days: overdueAging.filter((d) => d >= 90).length,
        };

        const deptMap = new Map<string, { overdue: number; due: number; active: number; total: number }>();
        for (const wo of vesselWOs) {
          if (wo.status === "Completed") continue;
          const dept = wo.department || "Unknown";
          const existing = deptMap.get(dept) || { overdue: 0, due: 0, active: 0, total: 0 };
          existing.total++;
          if (wo.status === "Overdue") existing.overdue++;
          else if (wo.status === "Due" || wo.status === "Due (Grace P)") existing.due++;
          else if (wo.status === "Active") existing.active++;
          deptMap.set(dept, existing);
        }
        const workloadByDepartment = Array.from(deptMap.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .map(([department, data]) => ({ department, ...data }));

        const assigneeMap = new Map<string, number>();
        for (const wo of [...overdue, ...dueThisWeek]) {
          const assignee = wo.assignedTo || "Unassigned";
          assigneeMap.set(assignee, (assigneeMap.get(assignee) || 0) + 1);
        }
        const workloadByAssignee = Array.from(assigneeMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([assignee, count]) => ({ assignee, urgentItemCount: count }));

        const highestPriorityOverdue = overdue
          .filter((wo) => wo.jobPriority === "Critical" || wo.jobPriority === "High")
          .sort((a, b) => {
            const aDays = a.dueDate ? (now.getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24) : 0;
            const bDays = b.dueDate ? (now.getTime() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24) : 0;
            return bDays - aDays;
          })
          .slice(0, 5)
          .map((wo) => ({
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            jobTitle: wo.jobTitle,
            priority: wo.jobPriority,
            daysOverdue: wo.dueDate ? Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
            assignedTo: wo.assignedTo,
            department: wo.department,
          }));

        return {
          dueThisWeek: {
            total: dueThisWeek.length,
            byPriority: dueThisWeekByPriority,
          },
          overdueBacklog: {
            total: overdue.length,
            agingBuckets,
            oldestDays: overdueAging.length > 0 ? Math.max(...overdueAging) : 0,
            averageDays: overdueAging.length > 0 ? Math.round(overdueAging.reduce((a, b) => a + b, 0) / overdueAging.length) : 0,
          },
          workloadByDepartment,
          workloadByAssignee,
          schedulingPriorities: highestPriorityOverdue,
        };
      }

      case "get_component_health_score": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const components = await storage.getComponents(args.vesselId);
        const topN = args.topN || 10;

        let defects: any[] = [];
        try {
          defects = await storage.getDefects({ vesselId: args.vesselId });
        } catch (e) {}

        let recurringDefects: any[] = [];
        try {
          recurringDefects = await storage.getRecurringDefects({});
        } catch (e) {}

        const now = new Date();
        const componentScores = new Map<string, {
          componentName: string;
          componentCode: string;
          critical: boolean;
          overdueCount: number;
          totalWOs: number;
          activeDefects: number;
          recurringDefectCount: number;
          oldestOverdueDays: number;
          riskScore: number;
        }>();

        for (const comp of components) {
          const compName = comp.name || "";
          const compCode = comp.componentCode || "";
          const isCritical = comp.critical === true;

          const compWOs = vesselWOs.filter((wo) => wo.componentCode === compCode || wo.component === compName);
          const compOverdue = compWOs.filter((wo) => wo.status === "Overdue");
          const compDefects = defects.filter((d) => d.status !== "Closed" && (d.equipmentType?.includes(compName) || d.equipmentCategory?.includes(compCode)));

          let oldestOverdueDays = 0;
          for (const wo of compOverdue) {
            if (wo.dueDate) {
              const days = Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24));
              oldestOverdueDays = Math.max(oldestOverdueDays, days);
            }
          }

          let riskScore = 0;
          riskScore += isCritical ? 30 : 0;
          riskScore += Math.min(compOverdue.length * 10, 40);
          riskScore += Math.min(compDefects.length * 15, 30);
          riskScore += oldestOverdueDays > 90 ? 20 : oldestOverdueDays > 60 ? 15 : oldestOverdueDays > 30 ? 10 : 0;

          if (riskScore > 0) {
            componentScores.set(compCode || compName, {
              componentName: compName,
              componentCode: compCode,
              critical: isCritical,
              overdueCount: compOverdue.length,
              totalWOs: compWOs.length,
              activeDefects: compDefects.length,
              recurringDefectCount: 0,
              oldestOverdueDays,
              riskScore,
            });
          }
        }

        for (const rd of recurringDefects) {
          const key = rd.equipmentKey || "";
          componentScores.forEach((score, compKey) => {
            if (key && (compKey.includes(key) || score.componentName.includes(key))) {
              score.recurringDefectCount++;
              score.riskScore += 10;
            }
          });
        }

        const topRiskComponents = Array.from(componentScores.values())
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, topN);

        const totalComponents = components.length;
        const componentsWithOverdue = new Set(vesselWOs.filter((wo) => wo.status === "Overdue").map((wo) => wo.componentCode)).size;
        const componentsWithDefects = new Set(defects.filter((d) => d.status !== "Closed").map((d) => d.equipmentType)).size;

        return {
          totalComponents,
          componentsWithOverdueMaintenance: componentsWithOverdue,
          componentsWithActiveDefects: componentsWithDefects,
          topRiskComponents,
          riskDistribution: {
            highRisk: topRiskComponents.filter((c) => c.riskScore >= 60).length,
            mediumRisk: topRiskComponents.filter((c) => c.riskScore >= 30 && c.riskScore < 60).length,
            lowRisk: topRiskComponents.filter((c) => c.riskScore < 30).length,
          },
        };
      }

      case "get_performance_trends": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const periodDays = args.periodDays || 90;
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(now.getDate() - periodDays);

        const completedInPeriod = vesselWOs.filter((wo) => wo.status === "Completed" && wo.dateCompleted && new Date(wo.dateCompleted) >= periodStart);
        const createdOrDueInPeriod = vesselWOs.filter((wo) => wo.dueDate && new Date(wo.dueDate) >= periodStart && new Date(wo.dueDate) <= now);

        const completionRate = createdOrDueInPeriod.length > 0 ? Math.round((completedInPeriod.length / createdOrDueInPeriod.length) * 100) : 0;

        const periods = [
          { label: "Last 30 days", days: 30 },
          { label: "Last 60 days", days: 60 },
          { label: "Last 90 days", days: 90 },
        ];
        const completionByPeriod = periods.map((p) => {
          const pStart = new Date();
          pStart.setDate(now.getDate() - p.days);
          const comp = vesselWOs.filter((wo) => wo.status === "Completed" && wo.dateCompleted && new Date(wo.dateCompleted) >= pStart).length;
          const total = vesselWOs.filter((wo) => wo.dueDate && new Date(wo.dueDate) >= pStart && new Date(wo.dueDate) <= now).length;
          return { period: p.label, completed: comp, totalDue: total, rate: total > 0 ? Math.round((comp / total) * 100) : 0 };
        });

        const avgCompletionByPriority: Record<string, { count: number; avgDays: number }> = {};
        for (const wo of completedInPeriod) {
          if (wo.dueDate && wo.dateCompleted) {
            const dueDate = new Date(wo.dueDate);
            const completedDate = new Date(wo.dateCompleted);
            const days = Math.floor((completedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const priority = wo.jobPriority || "Unassigned";
            if (!avgCompletionByPriority[priority]) {
              avgCompletionByPriority[priority] = { count: 0, avgDays: 0 };
            }
            avgCompletionByPriority[priority].count++;
            avgCompletionByPriority[priority].avgDays += days;
          }
        }
        for (const key in avgCompletionByPriority) {
          const data = avgCompletionByPriority[key];
          data.avgDays = data.count > 0 ? Math.round(data.avgDays / data.count) : 0;
        }

        let defects: any[] = [];
        try {
          defects = await storage.getDefects({ vesselId: args.vesselId });
        } catch (e) {}

        const resolvedDefects = defects.filter((d) => d.status === "Closed" && d.dateCompleted && new Date(d.dateCompleted) >= periodStart);
        const activeDefects = defects.filter((d) => d.status !== "Closed");
        const avgDefectResolutionDays = resolvedDefects.length > 0 ? Math.round(
          resolvedDefects.reduce((sum, d) => {
            const issued = d.issueDate ? new Date(d.issueDate) : now;
            const closed = d.dateCompleted ? new Date(d.dateCompleted) : now;
            return sum + Math.floor((closed.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / resolvedDefects.length
        ) : null;

        const overdueCount = vesselWOs.filter((wo) => wo.status === "Overdue").length;
        const overduePercent = vesselWOs.length > 0 ? Math.round((overdueCount / vesselWOs.length) * 100) : 0;

        return {
          periodDays,
          overallCompletionRate: completionRate,
          completionByPeriod,
          avgCompletionTimeByPriority: avgCompletionByPriority,
          defectMetrics: {
            activeDefects: activeDefects.length,
            resolvedInPeriod: resolvedDefects.length,
            avgResolutionDays: avgDefectResolutionDays,
          },
          currentOverdueRate: {
            count: overdueCount,
            percent: overduePercent,
          },
          completedInPeriod: completedInPeriod.length,
        };
      }

      case "get_running_hours_analytics": {
        const components = await storage.getComponents(args.vesselId);
        const vesselComps = components.filter((c) => c.dataScope === "vessel" && c.isActive !== false);
        const rhComponents = vesselComps.filter((c) => c.rhCounterType === "MASTER" || c.rhCounterType === "INHERITED");
        
        let filteredComps = rhComponents;
        if (args.componentFilter) {
          const filter = args.componentFilter.toLowerCase();
          filteredComps = rhComponents.filter((c) => 
            (c.name || "").toLowerCase().includes(filter) || 
            (c.componentCode || "").toLowerCase().includes(filter)
          );
        }

        const now = new Date();
        const analyticsResults: any[] = [];

        for (const comp of filteredComps.slice(0, 20)) {
          const audits = await storage.getRunningHoursAudits(comp.id, 100);
          const sortedAudits = audits.sort((a, b) => new Date(b.enteredAtUTC).getTime() - new Date(a.enteredAtUTC).getTime());
          
          const currentRH = parseFloat(String(comp.currentCumulativeRH || "0"));
          
          const calcAccum = (days: number) => {
            const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            const periodAudits = sortedAudits.filter((a) => new Date(a.enteredAtUTC) >= cutoff);
            if (periodAudits.length === 0) return 0;
            const deltas = periodAudits.map((a) => parseFloat(String(a.newRH)) - parseFloat(String(a.previousRH)));
            return Math.round(deltas.filter((d) => d > 0).reduce((s, d) => s + d, 0) * 100) / 100;
          };

          const accum30 = calcAccum(30);
          const accum60 = calcAccum(60);
          const accum90 = calcAccum(90);

          let anomaly: string | null = null;
          if (sortedAudits.length >= 3) {
            const recentDeltas = sortedAudits.slice(0, 5).map((a) => parseFloat(String(a.newRH)) - parseFloat(String(a.previousRH)));
            const avgDelta = recentDeltas.reduce((s, d) => s + d, 0) / recentDeltas.length;
            const maxDelta = Math.max(...recentDeltas);
            if (maxDelta > avgDelta * 3 && avgDelta > 0) anomaly = "SPIKE_DETECTED";
            const negatives = recentDeltas.filter((d) => d < 0);
            if (negatives.length > 0) anomaly = "NEGATIVE_READING";
            if (accum30 === 0 && accum90 > 0) anomaly = "NO_RECENT_UPDATES";
          }

          analyticsResults.push({
            componentName: comp.name,
            componentCode: comp.componentCode,
            counterType: comp.rhCounterType,
            currentRH,
            accumulation: { last30days: accum30, last60days: accum60, last90days: accum90 },
            dailyAvg: accum90 > 0 ? Math.round((accum90 / 90) * 100) / 100 : 0,
            totalAuditEntries: sortedAudits.length,
            lastUpdated: sortedAudits[0]?.dateUpdatedLocal || "Never",
            anomaly,
          });
        }

        const allWOs = await storage.getWorkOrders(args.vesselId);
        const rhBasedDue = allWOs.filter((wo) => wo.dataScope === "vessel" && (wo.status === "Due" || wo.status === "Overdue") && wo.driverType === "RH");

        return {
          totalRHComponents: rhComponents.length,
          showing: analyticsResults.length,
          components: analyticsResults,
          rhBasedMaintenanceDue: rhBasedDue.length,
          rhDueItems: rhBasedDue.slice(0, 5).map((wo) => ({
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            jobTitle: wo.jobTitle,
            status: wo.status,
          })),
          anomaliesDetected: analyticsResults.filter((r) => r.anomaly !== null).length,
        };
      }

      case "get_maintenance_planner": {
        const periodDays = args.periodDays || 90;
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const now = new Date();
        const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

        const dueAndOverdue = vesselWOs.filter((wo) => {
          if (wo.status === "Overdue") return true;
          if ((wo.status === "Due" || wo.status === "Due (Grace P)") && wo.dueDate) {
            return new Date(wo.dueDate) <= periodEnd;
          }
          return false;
        });

        const weekBuckets: Record<string, { total: number; critical: number; high: number; medium: number; low: number; overdue: number }> = {};
        const overdueItems = dueAndOverdue.filter((wo) => wo.status === "Overdue");
        weekBuckets["Overdue (Immediate)"] = {
          total: overdueItems.length,
          critical: overdueItems.filter((wo) => wo.jobPriority === "Critical").length,
          high: overdueItems.filter((wo) => wo.jobPriority === "High").length,
          medium: overdueItems.filter((wo) => wo.jobPriority === "Medium").length,
          low: overdueItems.filter((wo) => !wo.jobPriority || wo.jobPriority === "Low").length,
          overdue: overdueItems.length,
        };

        for (let weekStart = new Date(now); weekStart < periodEnd; weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          const weekLabel = `Week of ${weekStart.toISOString().split("T")[0]}`;
          const weekWOs = dueAndOverdue.filter((wo) => {
            if (wo.status === "Overdue") return false;
            if (!wo.dueDate) return false;
            const due = new Date(wo.dueDate);
            return due >= weekStart && due < weekEnd;
          });
          if (weekWOs.length > 0) {
            weekBuckets[weekLabel] = {
              total: weekWOs.length,
              critical: weekWOs.filter((wo) => wo.jobPriority === "Critical").length,
              high: weekWOs.filter((wo) => wo.jobPriority === "High").length,
              medium: weekWOs.filter((wo) => wo.jobPriority === "Medium").length,
              low: weekWOs.filter((wo) => !wo.jobPriority || wo.jobPriority === "Low").length,
              overdue: 0,
            };
          }
        }

        const deptDistribution: Record<string, number> = {};
        for (const wo of dueAndOverdue) {
          const dept = wo.department || "Unassigned";
          deptDistribution[dept] = (deptDistribution[dept] || 0) + 1;
        }

        const criticalPath = dueAndOverdue
          .filter((wo) => wo.jobPriority === "Critical" || wo.status === "Overdue")
          .slice(0, 10)
          .map((wo) => ({
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            jobTitle: wo.jobTitle,
            dueDate: wo.dueDate,
            status: wo.status,
            priority: wo.jobPriority,
          }));

        return {
          periodDays,
          totalItemsInPeriod: dueAndOverdue.length,
          weeklyBreakdown: weekBuckets,
          departmentDistribution: deptDistribution,
          criticalPathItems: criticalPath.length,
          criticalItems: criticalPath,
          peakWeek: Object.entries(weekBuckets).sort((a, b) => b[1].total - a[1].total)[0]?.[0] || "None",
        };
      }

      case "get_rob_analysis": {
        const spares = await storage.getSpares(args.vesselId);
        const activeSpares = spares.filter((sp) => !sp.deleted);
        const includeOverstock = args.includeOverstock !== false;

        const zeroStock = activeSpares.filter((sp) => (sp.rob ?? 0) === 0 && sp.min !== null && sp.min > 0);
        const belowMin = activeSpares.filter((sp) => sp.rob !== null && sp.min !== null && sp.rob > 0 && sp.rob < sp.min);
        const overstocked = includeOverstock ? activeSpares.filter((sp) => sp.rob !== null && sp.max !== null && sp.max > 0 && sp.rob > sp.max) : [];

        let history: any[] = [];
        try { history = await storage.getSpareHistory(args.vesselId); } catch (e) {}
        const consumeEvents = history.filter((h: any) => h.eventType === "CONSUME");
        
        const consumptionBySpare = new Map<number, number>();
        const now = new Date();
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        for (const evt of consumeEvents) {
          if (evt.timestampUTC && new Date(evt.timestampUTC) >= sixMonthsAgo) {
            const qty = Math.abs(evt.qtyChange || 0);
            consumptionBySpare.set(evt.spareId, (consumptionBySpare.get(evt.spareId) || 0) + qty);
          }
        }

        const stockoutEstimates = belowMin.concat(zeroStock.filter((sp) => {
          const consumed = consumptionBySpare.get(sp.id) || 0;
          return consumed > 0;
        })).slice(0, 10).map((sp) => {
          const consumed6m = consumptionBySpare.get(sp.id) || 0;
          const monthlyRate = consumed6m / 6;
          const currentROB = sp.rob ?? 0;
          const daysToStockout = monthlyRate > 0 ? Math.round((currentROB / (monthlyRate / 30))) : null;
          return {
            partCode: sp.partCode,
            partName: sp.partName,
            componentName: sp.componentName,
            rob: currentROB,
            min: sp.min,
            critical: sp.critical,
            monthlyConsumptionRate: Math.round(monthlyRate * 100) / 100,
            estimatedDaysToStockout: daysToStockout,
          };
        }).sort((a, b) => (a.estimatedDaysToStockout ?? 999) - (b.estimatedDaysToStockout ?? 999));

        return {
          totalActiveSpares: activeSpares.length,
          summary: {
            zeroStockItems: zeroStock.length,
            belowMinimum: belowMin.length,
            overstocked: overstocked.length,
            criticalZeroStock: zeroStock.filter((sp) => sp.critical === "Critical" || sp.critical === "Yes").length,
          },
          zeroStockCritical: zeroStock
            .filter((sp) => sp.critical === "Critical" || sp.critical === "Yes")
            .slice(0, 10)
            .map((sp) => ({ partCode: sp.partCode, partName: sp.partName, componentName: sp.componentName, min: sp.min })),
          stockoutRiskItems: stockoutEstimates,
          overstockedItems: overstocked.slice(0, 5).map((sp) => ({
            partCode: sp.partCode,
            partName: sp.partName,
            rob: sp.rob,
            max: sp.max,
            excess: (sp.rob ?? 0) - (sp.max ?? 0),
          })),
        };
      }

      case "get_change_request_analysis": {
        const changeRequests = await storage.getChangeRequests({ vesselId: args.vesselId });
        const now = new Date();

        const byStatus: Record<string, number> = {};
        for (const cr of changeRequests) {
          byStatus[cr.status] = (byStatus[cr.status] || 0) + 1;
        }

        const pending = changeRequests.filter((cr) => cr.status === "submitted");
        const pendingAging = pending.map((cr) => {
          const submitted = cr.submittedAt ? new Date(cr.submittedAt) : new Date(cr.createdAt);
          const ageDays = Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: cr.id,
            title: cr.title,
            category: cr.category,
            targetType: cr.targetType,
            submittedDaysAgo: ageDays,
            requestedBy: cr.requestedByUserId,
          };
        }).sort((a, b) => b.submittedDaysAgo - a.submittedDaysAgo);

        const byCategory: Record<string, number> = {};
        for (const cr of changeRequests) {
          const cat = cr.category || "Uncategorized";
          byCategory[cat] = (byCategory[cat] || 0) + 1;
        }

        const byTargetType: Record<string, number> = {};
        for (const cr of changeRequests) {
          const tt = cr.targetType || "Unknown";
          byTargetType[tt] = (byTargetType[tt] || 0) + 1;
        }

        const approved = changeRequests.filter((cr) => cr.status === "approved");
        const recentApproved = approved
          .filter((cr) => cr.reviewedAt && new Date(cr.reviewedAt) >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
          .slice(0, 5)
          .map((cr) => ({ id: cr.id, title: cr.title, category: cr.category, targetType: cr.targetType, revisionNumber: cr.revisionNumber }));

        return {
          totalRequests: changeRequests.length,
          byStatus,
          pendingCount: pending.length,
          oldestPendingDays: pendingAging.length > 0 ? pendingAging[0].submittedDaysAgo : 0,
          pendingRequests: pendingAging.slice(0, 10),
          byCategory,
          byTargetType,
          recentlyApproved: recentApproved,
          avgApprovalTimeDays: approved.length > 0 ? Math.round(
            approved.filter((cr) => cr.submittedAt && cr.reviewedAt).reduce((sum, cr) => {
              const sub = new Date(cr.submittedAt!);
              const rev = new Date(cr.reviewedAt!);
              return sum + Math.floor((rev.getTime() - sub.getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / Math.max(approved.filter((cr) => cr.submittedAt && cr.reviewedAt).length, 1)
          ) : null,
        };
      }

      case "get_recurring_defect_analysis": {
        const windowMonths = args.windowMonths || 12;
        const recurringDefectsData = await storage.getRecurringDefects({ windowMonths });

        const sorted = [...recurringDefectsData].sort((a, b) => b.occurrenceCount - a.occurrenceCount);

        const results = [];
        for (const rd of sorted.slice(0, 15)) {
          let linkedDefects: any[] = [];
          try { linkedDefects = await storage.getDefectsForRecurring(rd.id); } catch (e) {}

          results.push({
            equipmentKey: rd.equipmentKey,
            occurrenceCount: rd.occurrenceCount,
            openCount: rd.openCount,
            vesselsAffected: rd.vesselsAffected,
            hasCoc: rd.hasCoc,
            mtbfDays: rd.mtbfDays ? parseFloat(String(rd.mtbfDays)) : null,
            lastOccurrence: rd.lastOccurrenceDate,
            linkedDefectCount: linkedDefects.length,
            severity: rd.occurrenceCount >= 5 ? "HIGH" : rd.occurrenceCount >= 3 ? "MEDIUM" : "LOW",
          });
        }

        const cocItems = recurringDefectsData.filter((rd) => rd.hasCoc);
        const highFrequency = recurringDefectsData.filter((rd) => rd.occurrenceCount >= 5);

        return {
          windowMonths,
          totalRecurringGroups: recurringDefectsData.length,
          analysisSummary: {
            highFrequencyItems: highFrequency.length,
            conditionOfClassItems: cocItems.length,
            multiVesselIssues: recurringDefectsData.filter((rd) => rd.vesselsAffected > 1).length,
            avgOccurrences: recurringDefectsData.length > 0 ? Math.round(recurringDefectsData.reduce((s, rd) => s + rd.occurrenceCount, 0) / recurringDefectsData.length * 10) / 10 : 0,
          },
          topRecurringDefects: results,
          cocAlerts: cocItems.slice(0, 5).map((rd) => ({
            equipmentKey: rd.equipmentKey,
            occurrences: rd.occurrenceCount,
            openCount: rd.openCount,
            lastOccurrence: rd.lastOccurrenceDate,
          })),
        };
      }

      case "get_compliance_alerts": {
        const periodDays = args.periodDays || 90;
        const now = new Date();

        let certAlerts: any[] = [];
        let surveyAlerts: any[] = [];
        
        try {
          const db = await getDb();
          const certData = await db.select().from(vesselCertificateData).where(eq(vesselCertificateData.vesselId, args.vesselId));
          const certMasters = await db.select().from(shipCertificatesMaster);
          const certMasterMap = new Map(certMasters.map((m) => [m.masterId, m]));

          for (const cert of certData) {
            if (!cert.expiryDate) continue;
            const parts = cert.expiryDate.split(/[-/]/);
            let expiryDate: Date | null = null;
            if (parts.length === 3) {
              expiryDate = new Date(cert.expiryDate);
              if (isNaN(expiryDate.getTime())) {
                const [d, m, y] = parts;
                expiryDate = new Date(`${y}-${m}-${d}`);
              }
            }
            if (!expiryDate || isNaN(expiryDate.getTime())) continue;

            const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const master = certMasterMap.get(cert.masterId);

            if (daysUntilExpiry <= periodDays) {
              certAlerts.push({
                certificateName: master?.certificateName || cert.masterId,
                masterId: cert.masterId,
                expiryDate: cert.expiryDate,
                daysUntilExpiry,
                status: daysUntilExpiry < 0 ? "EXPIRED" : daysUntilExpiry <= 30 ? "CRITICAL" : daysUntilExpiry <= 60 ? "WARNING" : "UPCOMING",
                category: master?.category,
              });
            }
          }

          const surveyData = await db.select().from(vesselSurveyData).where(eq(vesselSurveyData.vesselId, args.vesselId));
          const surveyMasters = await db.select().from(shipSurveysMaster);
          const surveyMasterMap = new Map(surveyMasters.map((m) => [m.masterId, m]));

          for (const survey of surveyData) {
            if (!survey.dueDate) continue;
            let dueDate = new Date(survey.dueDate);
            if (isNaN(dueDate.getTime())) {
              const parts = survey.dueDate.split(/[-/]/);
              if (parts.length === 3) dueDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            if (isNaN(dueDate.getTime())) continue;

            const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const master = surveyMasterMap.get(survey.masterId);

            if (daysUntilDue <= periodDays) {
              surveyAlerts.push({
                surveyName: master?.surveyName || survey.masterId,
                masterId: survey.masterId,
                dueDate: survey.dueDate,
                daysUntilDue,
                status: daysUntilDue < 0 ? "OVERDUE" : daysUntilDue <= 30 ? "CRITICAL" : daysUntilDue <= 60 ? "WARNING" : "UPCOMING",
                category: master?.category,
              });
            }
          }
        } catch (e: any) {
          console.error("[Chatbot] Compliance alerts error:", e.message);
        }

        certAlerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        surveyAlerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

        return {
          periodDays,
          certificates: {
            total: certAlerts.length,
            expired: certAlerts.filter((c) => c.status === "EXPIRED").length,
            critical: certAlerts.filter((c) => c.status === "CRITICAL").length,
            warning: certAlerts.filter((c) => c.status === "WARNING").length,
            items: certAlerts.slice(0, 10),
          },
          surveys: {
            total: surveyAlerts.length,
            overdue: surveyAlerts.filter((s) => s.status === "OVERDUE").length,
            critical: surveyAlerts.filter((s) => s.status === "CRITICAL").length,
            warning: surveyAlerts.filter((s) => s.status === "WARNING").length,
            items: surveyAlerts.slice(0, 10),
          },
          totalActionItems: certAlerts.filter((c) => c.status === "EXPIRED" || c.status === "CRITICAL").length +
            surveyAlerts.filter((s) => s.status === "OVERDUE" || s.status === "CRITICAL").length,
        };
      }

      case "get_equipment_comparison": {
        const filter = (args.equipmentFilter || "").toLowerCase();
        const eqComponents = await storage.getComponents(args.vesselId);
        const matching = eqComponents.filter((c) => c.dataScope === "vessel" && c.isActive !== false && (
          (c.name || "").toLowerCase().includes(filter) ||
          (c.componentCode || "").toLowerCase().includes(filter) ||
          (c.fleetEquipmentName || "").toLowerCase().includes(filter)
        ));

        if (matching.length === 0) {
          return { error: `No equipment found matching "${args.equipmentFilter}". Try a broader search term.`, suggestions: ["pump", "separator", "generator", "compressor", "engine"] };
        }

        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        let defects: any[] = [];
        try { defects = await storage.getDefects({ vesselId: args.vesselId }); } catch (e) {}

        const comparison = matching.slice(0, 15).map((comp) => {
          const compWOs = vesselWOs.filter((wo) => wo.componentCode === comp.componentCode || wo.component === comp.name);
          const overdueCount = compWOs.filter((wo) => wo.status === "Overdue").length;
          const completedCount = compWOs.filter((wo) => wo.status === "Completed").length;
          const compDefects = defects.filter((d: any) => d.status !== "Closed" && (d.equipmentType?.includes(comp.name || "") || d.equipmentCategory?.includes(comp.componentCode || "")));
          const currentRH = parseFloat(String(comp.currentCumulativeRH || "0"));
          
          let healthScore = 100;
          healthScore -= overdueCount * 15;
          healthScore -= compDefects.length * 20;
          healthScore = Math.max(0, Math.min(100, healthScore));

          return {
            componentName: comp.name,
            componentCode: comp.componentCode,
            critical: comp.critical,
            currentRH: currentRH > 0 ? currentRH : null,
            totalWOs: compWOs.length,
            overdueWOs: overdueCount,
            completedWOs: completedCount,
            activeDefects: compDefects.length,
            healthScore,
            status: healthScore >= 80 ? "GOOD" : healthScore >= 50 ? "FAIR" : "POOR",
          };
        }).sort((a, b) => a.healthScore - b.healthScore);

        const scores = comparison.map((c) => c.healthScore);
        const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

        return {
          equipmentFilter: args.equipmentFilter,
          totalMatching: matching.length,
          showing: comparison.length,
          avgHealthScore: avg,
          bestPerformer: comparison[comparison.length - 1]?.componentName || "N/A",
          worstPerformer: comparison[0]?.componentName || "N/A",
          equipment: comparison,
          variance: scores.length > 1 ? Math.round(Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / scores.length)) : 0,
        };
      }

      case "get_cost_impact_estimate": {
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const overdue = vesselWOs.filter((wo) => wo.status === "Overdue");
        const now = new Date();

        const riskItems = overdue.map((wo) => {
          const daysOverdue = wo.dueDate ? Math.floor((now.getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const isCritical = wo.jobPriority === "Critical";
          const isHigh = wo.jobPriority === "High";
          
          let riskLevel = "LOW";
          let riskScore = 0;
          if (isCritical && daysOverdue > 30) { riskLevel = "CRITICAL"; riskScore = 90; }
          else if (isCritical || (isHigh && daysOverdue > 60)) { riskLevel = "HIGH"; riskScore = 70; }
          else if (isHigh || daysOverdue > 90) { riskLevel = "MEDIUM"; riskScore = 50; }
          else { riskLevel = "LOW"; riskScore = 20; }

          let riskCategory = "OPERATIONAL";
          if (isCritical || wo.classRelated === "Yes") riskCategory = "SAFETY";

          return {
            workOrderNo: wo.workOrderNo,
            component: wo.component,
            jobTitle: wo.jobTitle,
            priority: wo.jobPriority,
            daysOverdue,
            riskLevel,
            riskScore,
            riskCategory,
            estimatedLaborHours: isCritical ? 8 : isHigh ? 6 : 4,
          };
        }).sort((a, b) => b.riskScore - a.riskScore);

        const byCat: Record<string, number> = {};
        for (const item of riskItems) { byCat[item.riskCategory] = (byCat[item.riskCategory] || 0) + 1; }

        const totalEstimatedHours = riskItems.reduce((s, i) => s + i.estimatedLaborHours, 0);

        return {
          totalOverdueItems: overdue.length,
          riskSummary: {
            critical: riskItems.filter((i) => i.riskLevel === "CRITICAL").length,
            high: riskItems.filter((i) => i.riskLevel === "HIGH").length,
            medium: riskItems.filter((i) => i.riskLevel === "MEDIUM").length,
            low: riskItems.filter((i) => i.riskLevel === "LOW").length,
          },
          byRiskCategory: byCat,
          estimatedTotalLaborHours: totalEstimatedHours,
          estimatedManDays: Math.ceil(totalEstimatedHours / 8),
          topRiskItems: riskItems.slice(0, 10),
          averageDaysOverdue: riskItems.length > 0 ? Math.round(riskItems.reduce((s, i) => s + i.daysOverdue, 0) / riskItems.length) : 0,
        };
      }

      case "get_workload_forecast": {
        const forecastMonths = args.forecastMonths || 3;
        const allWOs = await storage.getWorkOrders(args.vesselId);
        const vesselWOs = allWOs.filter((wo) => wo.dataScope === "vessel");
        const now = new Date();

        const historicalMonths: Record<string, { completed: number; created: number }> = {};
        for (let i = 1; i <= 6; i++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const label = monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          const completed = vesselWOs.filter((wo) => wo.dateCompleted && new Date(wo.dateCompleted) >= monthStart && new Date(wo.dateCompleted) <= monthEnd).length;
          const created = vesselWOs.filter((wo) => wo.dueDate && new Date(wo.dueDate) >= monthStart && new Date(wo.dueDate) <= monthEnd).length;
          historicalMonths[label] = { completed, created };
        }

        const avgMonthlyCreated = Object.values(historicalMonths).reduce((s, v) => s + v.created, 0) / Math.max(Object.keys(historicalMonths).length, 1);
        const avgMonthlyCompleted = Object.values(historicalMonths).reduce((s, v) => s + v.completed, 0) / Math.max(Object.keys(historicalMonths).length, 1);

        const currentBacklog = vesselWOs.filter((wo) => wo.status === "Overdue" || wo.status === "Due" || wo.status === "Due (Grace P)").length;

        const forecast: Record<string, { predictedDue: number; estimatedBacklog: number }> = {};
        let runningBacklog = currentBacklog;
        for (let i = 0; i < forecastMonths; i++) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
          const label = monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          
          const dueInMonth = vesselWOs.filter((wo) => {
            if (!wo.dueDate) return false;
            const due = new Date(wo.dueDate);
            const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            return due >= monthDate && due <= monthEndDate && wo.status !== "Completed";
          }).length;
          
          const predicted = Math.max(dueInMonth, Math.round(avgMonthlyCreated));
          runningBacklog = runningBacklog + predicted - Math.round(avgMonthlyCompleted);
          if (runningBacklog < 0) runningBacklog = 0;
          
          forecast[label] = { predictedDue: predicted, estimatedBacklog: runningBacklog };
        }

        const byPriority: Record<string, number> = {};
        const upcoming = vesselWOs.filter((wo) => {
          if (!wo.dueDate || wo.status === "Completed") return false;
          const due = new Date(wo.dueDate);
          return due >= now && due <= new Date(now.getTime() + forecastMonths * 30 * 24 * 60 * 60 * 1000);
        });
        for (const wo of upcoming) {
          const p = wo.jobPriority || "Unassigned";
          byPriority[p] = (byPriority[p] || 0) + 1;
        }

        return {
          forecastMonths,
          currentBacklog,
          avgMonthlyWorkOrders: Math.round(avgMonthlyCreated),
          avgMonthlyCompletions: Math.round(avgMonthlyCompleted),
          completionCapacityRatio: avgMonthlyCreated > 0 ? Math.round((avgMonthlyCompleted / avgMonthlyCreated) * 100) : 100,
          historicalTrend: historicalMonths,
          forecast,
          upcomingByPriority: byPriority,
          bottleneckRisk: runningBacklog > currentBacklog * 1.5 ? "HIGH" : runningBacklog > currentBacklog ? "MODERATE" : "LOW",
        };
      }

      case "get_fleet_overview": {
        const db = await getDb();
        const allVessels = await db.select({
          id: vesselsTable.id,
          name: vesselsTable.name,
          code: vesselsTable.code,
          imoNumber: vesselsTable.imoNumber,
          vesselType: vesselsTable.vesselType,
          flag: vesselsTable.flag,
          isActive: vesselsTable.isActive,
        }).from(vesselsTable);
        const activeVessels = allVessels.filter(v => v.isActive !== false);
        return {
          totalVessels: allVessels.length,
          activeVessels: activeVessels.length,
          inactiveVessels: allVessels.length - activeVessels.length,
          vessels: allVessels.map(v => ({
            id: v.id,
            name: v.name || "Unnamed Vessel",
            code: v.code || null,
            imoNumber: v.imoNumber || null,
            vesselType: v.vesselType || null,
            flag: v.flag || null,
            status: v.isActive === false ? "Inactive" : "Active",
          })),
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[Chatbot] Tool execution error (${toolName}):`, error);
    return {
      error: `Failed to execute ${toolName}: ${error.message}`,
    };
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  vesselId: string;
  vesselName: string;
  currentPage: string;
  userRole: string;
}

export interface ChatResponse {
  response: string;
  toolsUsed: string[];
  conversationHistory: ChatMessage[];
}

export async function processChatMessage(
  message: string,
  conversationHistory: ChatMessage[],
  context: ChatContext,
  storage: IStorage
): Promise<ChatResponse> {
  const toolsUsed: string[] = [];

  try {
    const systemPrompt = buildSystemPrompt(context);

    const MAX_HISTORY = 20;
    let trimmedHistory = conversationHistory;
    let contextSummaryMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam | null = null;

    if (conversationHistory.length > MAX_HISTORY) {
      trimmedHistory = conversationHistory.slice(-MAX_HISTORY);
      contextSummaryMsg = {
        role: "system",
        content: `[Earlier conversation context: User has been analyzing vessel maintenance data for ${context.vesselName}. ${conversationHistory.length - MAX_HISTORY} older messages trimmed to maintain response quality. Continue the conversation naturally based on the remaining history.]`,
      };
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(contextSummaryMsg ? [contextSummaryMsg] : []),
      ...trimmedHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const openai = getOpenAIClient();

    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: CHATBOT_TOOLS,
      tool_choice: "auto",
      temperature: 0.4,
      max_tokens: 4000,
    });

    let assistantMessage = response.choices[0].message;
    let iterations = 0;
    const maxIterations = 8;

    while (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0 &&
      iterations < maxIterations
    ) {
      iterations++;

      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = (toolCall as any).function.name;
        const toolArgs = JSON.parse((toolCall as any).function.arguments);
        toolsUsed.push(toolName);

        console.log(`[Chatbot] Executing tool: ${toolName}`, toolArgs);
        const result = await executeTool(toolName, toolArgs, storage);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: CHATBOT_TOOLS,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 4000,
      });

      assistantMessage = response.choices[0].message;
    }

    const assistantContent =
      assistantMessage.content || "I was unable to generate a response.";

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: message },
      { role: "assistant", content: assistantContent },
    ];

    return {
      response: assistantContent,
      toolsUsed: Array.from(new Set(toolsUsed)),
      conversationHistory: updatedHistory,
    };
  } catch (error: any) {
    console.error("[Chatbot] Error processing message:", error);

    if (error.code === "insufficient_quota") {
      return {
        response:
          "I'm unable to process your request due to API quota limits. Please contact your system administrator.",
        toolsUsed: [],
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: message },
          {
            role: "assistant",
            content:
              "I'm unable to process your request due to API quota limits.",
          },
        ],
      };
    }

    return {
      response:
        "I'm having trouble connecting to my AI service right now. Please try again in a moment, or contact support if this persists.",
      toolsUsed: [],
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: message },
        {
          role: "assistant",
          content: "I'm having trouble connecting to my AI service right now.",
        },
      ],
    };
  }
}
