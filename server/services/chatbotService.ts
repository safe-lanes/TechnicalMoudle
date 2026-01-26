import OpenAI from "openai";
import { storage } from "../storage";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set up the OpenAI integration.");
    }
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `You are a PMS Assistant for vessel maintenance operations. You help ship crew and shore-based technical teams manage planned maintenance effectively.

## Your Role
- Answer questions about work orders, components, spares, and maintenance status
- Provide concise, action-oriented responses (vessel crew are busy)
- Highlight urgent/critical items prominently
- Suggest relevant follow-up actions

## Context
- Current Vessel ID: {{vesselId}}
- Current Vessel: {{vesselName}}
- Current Page: {{currentPage}}
- User Role: {{userRole}}

## Maritime Terminology You Understand
- ROB (Remaining On Board) - spare parts quantity in stock
- Running Hours (RH) - equipment operating hours
- Class surveys - classification society inspections
- Chief Engineer, 2nd Engineer, Captain - vessel officers
- Main Engine, Aux Boiler, Generators - key equipment
- SFI codes - standard equipment classification
- PMS - Planned Maintenance System

## Tool Usage Guidelines
- ALWAYS call get_work_order_counts first for summary questions like "PMS status"
- Use generate_deep_link when user asks to "show me", "take me to", or "open" something
- After listing items, ALWAYS offer to navigate or show details
- Combine multiple tool calls when needed (e.g., overdue WOs + low stock spares for priority analysis)
- If a work order number/ID is mentioned, call get_work_order_detail

## Response Format Examples

When listing work orders:
**Overdue Work Orders (8)**
| WO# | Description | Overdue By |
|-----|-------------|------------|
| WO-1234 | ME Piston And Rings Inspection (500H) | 15 days |
| WO-1235 | Provision Ref. Compressors Inspection | **CRITICAL** - 30 days |

When summarizing KPIs:
**PMS Status for {{vesselName}}**
- ⚠️ **Overdue:** 8 work orders (need immediate attention)
- 📋 **Due:** 151 work orders
- ✅ **Completed:** 6 work orders this period
- 🔧 **215 spares** are low stock (87 at minimum, 128 below minimum)

Would you like me to:
- Show overdue work order details
- Navigate to low stock spares
- Draft a briefing for the superintendent

## Limitations (Phase 1 - Read Only)
You can view and summarize data but cannot:
- Create or update work orders
- Change equipment status
- Create requisitions
If asked, explain: "I can't do that yet, but I can show you the relevant information to do it manually."`;

export const CHATBOT_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_work_orders",
      description: "Get work orders for a vessel with optional filters by status",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" },
          status: { 
            type: "string", 
            enum: ["Overdue", "Due", "Active", "Completed", "Pending Approval", "Postponed"],
            description: "Filter by work order status"
          },
          limit: { type: "number", description: "Max results to return (default 20)" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_work_order_detail",
      description: "Get detailed information about a specific work order by ID",
      parameters: {
        type: "object",
        properties: {
          workOrderId: { type: "string", description: "Work order ID" }
        },
        required: ["workOrderId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_work_orders",
      description: "Get all overdue work orders for a vessel that need immediate attention",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_due_work_orders",
      description: "Get work orders that are due (not yet overdue) for a vessel, optionally filtered by date range",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" },
          dateRange: { 
            type: "string", 
            enum: ["week", "month"],
            description: "Filter by 'week' (next 7 days) or 'month' (next 30 days)"
          }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_work_order_counts",
      description: "Get KPI counts for work orders: overdue, due, pending approval, completed, and total",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_spares",
      description: "Get spares where ROB (quantity in stock) is below minimum level",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_critical_spares",
      description: "Get spares that are both low stock AND marked as critical - these need urgent attention",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_components",
      description: "List components/equipment for a vessel, optionally filtered by critical status or search term",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" },
          critical: { type: "boolean", description: "Filter to only critical components" },
          search: { type: "string", description: "Search term to filter by component name" },
          parentId: { type: "string", description: "Filter to children of a specific parent component" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_running_hours",
      description: "Get running hours information for a specific component",
      parameters: {
        type: "object",
        properties: {
          componentId: { type: "string", description: "Component ID" }
        },
        required: ["componentId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_jobs",
      description: "List maintenance jobs (templates) for a vessel, optionally filtered by component",
      parameters: {
        type: "object",
        properties: {
          vesselId: { type: "string", description: "Vessel ID" },
          componentId: { type: "string", description: "Filter to jobs for a specific component" }
        },
        required: ["vesselId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_deep_link",
      description: "Generate a URL to navigate the user to a specific page in the PMS with optional filters",
      parameters: {
        type: "object",
        properties: {
          page: { 
            type: "string", 
            enum: ["workorders", "spares", "components", "dashboard", "running-hours", "stores", "jobs", "defects"],
            description: "The page to navigate to"
          },
          filters: { 
            type: "object",
            description: "Optional filters to apply (e.g., status, vesselId)"
          }
        },
        required: ["page"]
      }
    }
  }
];

export async function executeTool(
  name: string, 
  args: Record<string, any>,
  context: { vesselId: string }
): Promise<any> {
  const vesselId = args.vesselId || context.vesselId;
  
  try {
    switch (name) {
      case "get_work_orders": {
        const allWOs = await storage.getWorkOrders(vesselId);
        let filtered = allWOs;
        if (args.status) {
          filtered = allWOs.filter(wo => wo.status === args.status);
        }
        const limit = args.limit || 20;
        return filtered.slice(0, limit).map(wo => ({
          id: wo.id,
          workOrderNo: wo.workOrderNo,
          jobTitle: wo.jobTitle,
          component: wo.component,
          status: wo.status,
          dueDate: wo.dueDate,
          priority: wo.jobPriority
        }));
      }

      case "get_work_order_detail": {
        const wo = await storage.getWorkOrder(args.workOrderId);
        if (!wo) return { error: "Work order not found" };
        return wo;
      }

      case "get_overdue_work_orders": {
        const allWOs = await storage.getWorkOrders(vesselId);
        const overdue = allWOs.filter(wo => wo.status === "Overdue");
        return overdue.map(wo => ({
          id: wo.id,
          workOrderNo: wo.workOrderNo,
          jobTitle: wo.jobTitle,
          component: wo.component,
          status: wo.status,
          dueDate: wo.dueDate,
          priority: wo.jobPriority,
          daysOverdue: wo.dueDate ? Math.floor((new Date().getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : null
        }));
      }

      case "get_due_work_orders": {
        const allWOs = await storage.getWorkOrders(vesselId);
        const now = new Date();
        let dueWOs = allWOs.filter(wo => wo.status === "Due");
        
        if (args.dateRange === "week") {
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          dueWOs = dueWOs.filter(wo => 
            wo.dueDate && new Date(wo.dueDate) <= weekFromNow
          );
        } else if (args.dateRange === "month") {
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          dueWOs = dueWOs.filter(wo => 
            wo.dueDate && new Date(wo.dueDate) <= monthFromNow
          );
        }
        
        return dueWOs.map(wo => ({
          id: wo.id,
          workOrderNo: wo.workOrderNo,
          jobTitle: wo.jobTitle,
          component: wo.component,
          status: wo.status,
          dueDate: wo.dueDate,
          priority: wo.jobPriority
        }));
      }

      case "get_work_order_counts": {
        const workOrders = await storage.getWorkOrders(vesselId);
        return {
          overdue: workOrders.filter(w => w.status === "Overdue").length,
          due: workOrders.filter(w => w.status === "Due").length,
          pending: workOrders.filter(w => w.status === "Pending Approval").length,
          completed: workOrders.filter(w => w.status === "Completed").length,
          active: workOrders.filter(w => w.status === "Active").length,
          total: workOrders.length
        };
      }

      case "get_low_stock_spares": {
        const spares = await storage.getSpares(vesselId);
        const lowStock = spares.filter(s => {
          const rob = s.rob ?? 0;
          const min = s.min ?? 0;
          return rob < min;
        });
        return lowStock.map(s => ({
          id: s.id,
          partCode: s.partCode,
          partName: s.partName,
          rob: s.rob,
          min: s.min,
          componentName: s.componentName,
          critical: s.critical
        }));
      }

      case "get_critical_spares": {
        const spares = await storage.getSpares(vesselId);
        const criticalLow = spares.filter(s => {
          const rob = s.rob ?? 0;
          const min = s.min ?? 0;
          return (s.critical === "Critical" || s.critical === "Yes") && rob < min;
        });
        return criticalLow.map(s => ({
          id: s.id,
          partCode: s.partCode,
          partName: s.partName,
          rob: s.rob,
          min: s.min,
          componentName: s.componentName,
          urgency: "CRITICAL"
        }));
      }

      case "get_components": {
        let components = await storage.getComponents(vesselId);
        
        if (args.critical) {
          components = components.filter(c => c.critical === true);
        }
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          components = components.filter(c => 
            c.name?.toLowerCase().includes(searchLower) ||
            c.componentCode?.toLowerCase().includes(searchLower)
          );
        }
        if (args.parentId) {
          components = components.filter(c => c.parentId === args.parentId);
        }
        
        return components.slice(0, 50).map(c => ({
          id: c.id,
          componentCode: c.componentCode,
          name: c.name,
          critical: c.critical,
          currentCumulativeRH: c.currentCumulativeRH,
          department: c.department
        }));
      }

      case "get_running_hours": {
        const component = await storage.getComponent(args.componentId);
        if (!component) return { error: "Component not found" };
        
        const audits = await storage.getRunningHoursAudits(args.componentId, 5);
        return {
          componentId: component.id,
          componentName: component.name,
          currentRunningHours: component.currentCumulativeRH,
          lastUpdated: component.rhMasterUpdatedAt,
          recentUpdates: audits.map(a => ({
            date: a.dateUpdatedLocal,
            oldValue: a.previousRH,
            newValue: a.newRH,
            source: a.source
          }))
        };
      }

      case "get_jobs": {
        const jobs = await storage.getJobs(vesselId, args.componentId);
        return jobs.slice(0, 30).map(j => ({
          id: j.id,
          jobNo: j.jobNo,
          jobTitle: j.jobTitle,
          componentId: j.componentId,
          maintenanceBasis: j.maintenanceBasis,
          frequencyValue: j.frequencyValue,
          frequencyUnit: j.frequencyUnit
        }));
      }

      case "generate_deep_link": {
        const baseUrl = "/pms";
        const pageMap: Record<string, string> = {
          "workorders": "/work-orders",
          "spares": "/spares",
          "components": "/components",
          "dashboard": "/dashboard",
          "running-hours": "/running-hours",
          "stores": "/stores",
          "jobs": "/jobs",
          "defects": "/defects"
        };
        
        const pagePath = pageMap[args.page] || "/dashboard";
        const params = new URLSearchParams();
        
        if (args.filters) {
          Object.entries(args.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
        }
        
        const queryString = params.toString();
        const url = `${baseUrl}${pagePath}${queryString ? '?' + queryString : ''}`;
        
        return { url, description: `Navigate to ${args.page} page` };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error(`Tool execution error (${name}):`, error);
    return { error: `Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export interface ChatContext {
  vesselId: string;
  vesselName?: string;
  currentPage?: string;
  userRole?: string;
}

export interface ChatResult {
  response: string;
  toolsUsed: string[];
}

export async function processChatMessage(
  message: string,
  context: ChatContext,
  conversationHistory: ChatCompletionMessageParam[]
): Promise<ChatResult> {
  const toolsUsed: string[] = [];
  
  const systemPrompt = SYSTEM_PROMPT
    .replace(/\{\{vesselId\}\}/g, context.vesselId)
    .replace(/\{\{vesselName\}\}/g, context.vesselName || context.vesselId)
    .replace(/\{\{currentPage\}\}/g, context.currentPage || "Dashboard")
    .replace(/\{\{userRole\}\}/g, context.userRole || "User");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: message }
  ];

  try {
    const openai = getOpenAIClient();
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: CHATBOT_TOOLS,
      tool_choice: "auto",
      max_tokens: 2048
    });

    let assistantMessage = response.choices[0].message;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        
        const args = JSON.parse(toolCall.function.arguments);
        
        if (!args.vesselId && context.vesselId) {
          args.vesselId = context.vesselId;
        }
        
        const result = await executeTool(toolCall.function.name, args, context);
        toolsUsed.push(toolCall.function.name);
        
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: CHATBOT_TOOLS,
        tool_choice: "auto",
        max_tokens: 2048
      });
      assistantMessage = response.choices[0].message;
    }

    return {
      response: assistantMessage.content || "I couldn't generate a response. Please try again.",
      toolsUsed
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    
    return {
      response: "I'm having trouble connecting to my AI service right now. Please try again in a moment, or contact your system administrator if this persists.",
      toolsUsed: []
    };
  }
}
