export default function ApprovalWorkflow() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-semibold text-gray-800"
            data-testid="text-approval-workflow-title"
          >
            Approval Workflow
          </h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-testid="container-approval-workflow-body"
      />
    </div>
  );
}
