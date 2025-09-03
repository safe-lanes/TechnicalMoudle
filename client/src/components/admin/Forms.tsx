import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit, Search } from 'lucide-react';

interface FormItem {
  id: string;
  formName: string;
  formSubGroup: string;
  versionNo: string;
  versionDate: string;
}

export default function Forms() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mock data for forms
  const [forms] = useState<FormItem[]>([
    {
      id: '1',
      formName: 'Add Component Form',
      formSubGroup: 'NA',
      versionNo: '01',
      versionDate: '15 Jan 2025'
    },
    {
      id: '2',
      formName: 'Work Order Form',
      formSubGroup: 'New Work Order (Planned)',
      versionNo: '02',
      versionDate: '22 Mar 2025'
    },
    {
      id: '3',
      formName: 'Work Order Form',
      formSubGroup: 'New Unplanned Work Order',
      versionNo: '01',
      versionDate: '5 Jul 2025'
    }
  ]);

  // Filter forms based on search
  const filteredForms = forms.filter(form =>
    form.formName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.formSubGroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (formId: string) => {
    console.log('Editing form:', formId);
    // Implement edit functionality
  };

  return (
    <Card className="p-0 overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b bg-gray-50">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search Form"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#52baf3] text-white">
              <th className="px-6 py-3 text-left text-sm font-medium">Form Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Form Sub Group</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Version No</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Version Date</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredForms.length > 0 ? (
              filteredForms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {form.formName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {form.formSubGroup}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-center">
                    {form.versionNo}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-center">
                    {form.versionDate}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(form.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4 text-gray-600" />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No forms found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}