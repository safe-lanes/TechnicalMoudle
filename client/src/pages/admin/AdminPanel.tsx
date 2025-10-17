import { Settings, Users, Database, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPanel() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600 mt-2">Manage system-wide settings and configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>User Management</CardTitle>
              </div>
              <CardDescription>Manage system users and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Configure user access, roles, and permissions across the platform.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Settings className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>System Settings</CardTitle>
              </div>
              <CardDescription>Configure global system preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Adjust system-wide settings, notifications, and general configurations.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Database className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Data Management</CardTitle>
              </div>
              <CardDescription>Backup and maintenance tools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Database backup, restore, and system maintenance utilities.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Shield className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Security and audit settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Configure security policies, audit logs, and compliance settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
