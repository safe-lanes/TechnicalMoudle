import OpenAI from "openai";
import type { IStorage } from "../storage";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set. Please configure it to use the PMS Assistant.");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function buildSystemPrompt(context: {
  vesselName: string;
  vesselId: string;
  userRole: string;
  currentPage: string;
}) {
  return `You are an AI assistant for a Planned Maintenance System (PMS) used on maritime vessels.

CONTEXT:
- Current Vessel: ${context.vesselName} (ID: ${context.vesselId})
- Current User Role: ${context.userRole}
- Current Page: ${context.currentPage}
- Current Date: ${new Date().toISOString().split("T")[0]}

YOUR CAPABILITIES:
- Query work orders (overdue, due, completed) with filters
- Check spare parts inventory and low stock items
- View component details and running hours
- Generate maintenance status summaries and reports
- Create deep links to filtered dashboard views
- Provide maintenance prioritization recommendations

TONE & STYLE:
- Concise and action-oriented (crew are busy)
- Use maritime terminology (Main Engine, Chief Engineer, ROB, running hours)
- Highlight critical/urgent items clearly
- Always offer follow-up actions or navigation options
- Format lists and tables for easy scanning

TOOL USAGE GUIDELINES:
- ALWAYS call get_work_order_counts first for summary questions
- Use generate_deep_link when user asks to "show me" or "take me to"
- Combine multiple tool calls for complex queries (e.g., overdue WOs + low stock spares)
- After listing items, offer to show details or navigate

RESPONSE FORMAT:
- Use markdown for formatting
- Use tables for multiple items
- Highlight **critical** and **urgent** items
- Always end with: "Would you like me to..." suggestions`;
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
        const limit = args.limit || 50;
        const results = overdue.slice(0, limit);
        return {
          totalOverdue: overdue.length,
          showing: results.length,
          workOrders: results.map((wo) => ({
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
        return {
          total: vesselWOs.length,
          overdue: vesselWOs.filter((wo) => wo.status === "Overdue").length,
          due: vesselWOs.filter(
            (wo) => wo.status === "Due" || wo.status === "Due (Grace P)"
          ).length,
          completed: vesselWOs.filter((wo) => wo.status === "Completed").length,
          pendingApproval: vesselWOs.filter(
            (wo) => wo.status === "Pending Approval"
          ).length,
          active: vesselWOs.filter((wo) => wo.status === "Active").length,
          postponed: vesselWOs.filter((wo) => wo.status === "Postponed").length,
        };
      }

      case "get_low_stock_spares": {
        const spares = await storage.getSpares(args.vesselId);
        let lowStock = spares.filter(
          (sp) =>
            sp.rob !== null &&
            sp.min !== null &&
            sp.rob < sp.min &&
            !sp.deleted
        );

        if (args.criticalOnly) {
          lowStock = lowStock.filter(
            (sp) => sp.critical === "Critical" || sp.critical === "Yes"
          );
        }

        return {
          totalLowStock: lowStock.length,
          spares: lowStock.slice(0, 50).map((sp) => ({
            id: sp.id,
            partCode: sp.partCode,
            partName: sp.partName,
            componentName: sp.componentName,
            componentCode: sp.componentCode,
            rob: sp.rob,
            min: sp.min,
            critical: sp.critical,
            location: sp.location,
          })),
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

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg) => ({
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
      temperature: 0.3,
      max_tokens: 2000,
    });

    let assistantMessage = response.choices[0].message;
    let iterations = 0;
    const maxIterations = 5;

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
        temperature: 0.3,
        max_tokens: 2000,
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
