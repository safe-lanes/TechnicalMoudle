import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface WorkOrderDataTableProps {
  columns: Column[];
  data: any[];
  onAdd?: () => void;
  onEdit?: (row: any, index: number) => void;
  onDelete?: (row: any, index: number) => void;
  addButtonLabel?: string;
  showActions?: boolean;
}

export function WorkOrderDataTable({
  columns,
  data,
  onAdd,
  onEdit,
  onDelete,
  addButtonLabel = "Add Item",
  showActions = true
}: WorkOrderDataTableProps) {
  return (
    <div className="space-y-3">
      {onAdd && (
        <div className="flex justify-end">
          <Button
            onClick={onAdd}
            size="sm"
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            data-testid={`button-${addButtonLabel.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            {addButtonLabel}
          </Button>
        </div>
      )}
      
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
          <thead className="bg-[hsl(var(--table-header-bg))]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
              {showActions && (onEdit || onDelete) && (
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showActions && (onEdit || onDelete) ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[hsl(var(--table-row-alt))]'}
                  data-testid={`table-row-${rowIndex}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {showActions && (onEdit || onDelete) && (
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row, rowIndex)}
                            className="text-blue-600 hover:text-blue-800"
                            data-testid={`button-edit-row-${rowIndex}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row, rowIndex)}
                            className="text-red-600 hover:text-red-800"
                            data-testid={`button-delete-row-${rowIndex}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
