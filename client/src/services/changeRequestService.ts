// Change Request interfaces (duplicated here to avoid import issues)
export interface ChangeRequest {
  id: number;
  category: "components" | "work-orders" | "spares" | "stores" | "jobs";
  requestTitle: string;
  requestedBy: string;
  requestDate: string;
  status: "Pending Approval" | "Approved" | "Rejected";
  originalData: Record<string, any>;
  newData: Record<string, any>;
  changedFields: string[];
  comments?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
}

export interface ChangeLog {
  id: number;
  changeRequestId: number;
  action: "created" | "approved" | "rejected";
  performedBy: string;
  performedDate: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  comments?: string;
}

// In-memory storage for change requests (in production this would be a proper database)
let changeRequests: ChangeRequest[] = [
  {
    id: 1,
    category: "components",
    requestTitle: "Modify Main Engine Maintenance Schedule",
    requestedBy: "Chief Engineer",
    requestDate: "2025-05-20",
    status: "Pending Approval",
    originalData: { frequency: "6 Months", component: "Main Engine" },
    newData: { frequency: "3 Months", component: "Main Engine" },
    changedFields: ["frequency"],
    comments: "Increase frequency due to heavy usage"
  },
  {
    id: 2,
    category: "jobs",
    requestTitle: "Update Steering System Job Details",
    requestedBy: "2nd Engineer",
    requestDate: "2025-05-18",
    status: "Approved",
    originalData: { jobTitle: "Steering Maintenance", frequency: "1 Month" },
    newData: { jobTitle: "Steering System Check", frequency: "2 Weeks" },
    changedFields: ["jobTitle", "frequency"],
    approvedBy: "Technical Superintendent",
    approvedDate: "2025-05-19"
  },
  {
    id: 3,
    category: "spares",
    requestTitle: "Request Special Tool for Aux Engine",
    requestedBy: "3rd Engineer",
    requestDate: "2025-05-10",
    status: "Rejected",
    originalData: { partName: "Standard Tool", quantity: 1 },
    newData: { partName: "Special Hydraulic Tool", quantity: 2 },
    changedFields: ["partName", "quantity"],
    rejectionReason: "Budget constraints - use existing tools"
  }
];

let changeLogs: ChangeLog[] = [];
let nextId = 4;

export const changeRequestService = {
  // Get all change requests
  getAllChangeRequests: (): ChangeRequest[] => {
    return [...changeRequests];
  },

  // Get change requests by category
  getChangeRequestsByCategory: (category: string): ChangeRequest[] => {
    return changeRequests.filter(req => req.category === category);
  },

  // Get change request by ID
  getChangeRequestById: (id: number): ChangeRequest | undefined => {
    return changeRequests.find(req => req.id === id);
  },

  // Create new change request
  createChangeRequest: (request: Omit<ChangeRequest, 'id'>): ChangeRequest => {
    const newRequest: ChangeRequest = {
      ...request,
      id: nextId++
    };
    changeRequests.push(newRequest);
    
    // Log the creation
    changeLogs.push({
      id: changeLogs.length + 1,
      changeRequestId: newRequest.id,
      action: "created",
      performedBy: request.requestedBy,
      performedDate: request.requestDate,
      oldValues: request.originalData,
      newValues: request.newData,
      comments: request.comments
    });

    return newRequest;
  },

  // Approve change request
  approveChangeRequest: (id: number, approvedBy: string, comments?: string): boolean => {
    const requestIndex = changeRequests.findIndex(req => req.id === id);
    if (requestIndex === -1) return false;

    const request = changeRequests[requestIndex];
    const approvedDate = new Date().toISOString().split('T')[0];
    
    changeRequests[requestIndex] = {
      ...request,
      status: "Approved",
      approvedBy,
      approvedDate,
      comments: comments || request.comments
    };

    // Log the approval
    changeLogs.push({
      id: changeLogs.length + 1,
      changeRequestId: id,
      action: "approved",
      performedBy: approvedBy,
      performedDate: approvedDate,
      oldValues: request.originalData,
      newValues: request.newData,
      comments
    });

    return true;
  },

  // Reject change request
  rejectChangeRequest: (id: number, rejectedBy: string, reason: string): boolean => {
    const requestIndex = changeRequests.findIndex(req => req.id === id);
    if (requestIndex === -1) return false;

    const request = changeRequests[requestIndex];
    const rejectedDate = new Date().toISOString().split('T')[0];
    
    changeRequests[requestIndex] = {
      ...request,
      status: "Rejected",
      rejectionReason: reason,
      comments: reason
    };

    // Log the rejection
    changeLogs.push({
      id: changeLogs.length + 1,
      changeRequestId: id,
      action: "rejected",
      performedBy: rejectedBy,
      performedDate: rejectedDate,
      oldValues: request.originalData,
      newValues: request.newData,
      comments: reason
    });

    return true;
  },

  // Get change logs for audit
  getChangeLogs: (): ChangeLog[] => {
    return [...changeLogs];
  }
};