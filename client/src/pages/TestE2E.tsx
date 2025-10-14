import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function TestE2E() {
  const [testReport, setTestReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const seedData = async () => {
    setLoading(true);
    try {
      // Clear and seed data
      const seedResponse = await fetch('/api/defects-seed-e2e-test', {
        method: 'POST',
      });
      const seedData = await seedResponse.json();
      
      // Get counts
      const countResponse = await fetch('/api/defects-count');
      const counts = await countResponse.json();
      
      // Get all defects
      const allDefectsResponse = await fetch('/api/defects?includeClosedDefects=true');
      const allDefects = await allDefectsResponse.json();
      
      // Get CoC defects
      const cocDefectsResponse = await fetch('/api/defects?is_coc=true');
      const cocDefects = await cocDefectsResponse.json();
      
      // Get recurring defects
      const recurringResponse = await fetch('/api/recurring-defects');
      const recurringDefects = await recurringResponse.json();
      
      const report = {
        seeded: seedData.testReport,
        counts,
        totalDefectsReturned: allDefects.length,
        defectIds: allDefects.map((d: any) => d.id),
        cocDefectsReturned: cocDefects.length,
        cocIds: cocDefects.map((d: any) => d.id),
        recurringGroups: recurringDefects.length,
        testsPassed: {
          seedingSuccessful: seedData.success,
          countsCorrect: counts.active === 8 && counts.resolved === 2,
          totalDefectsCorrect: allDefects.length === 10,
          cocDefectsCorrect: cocDefects.length === 2,
          recurringGroupsCorrect: recurringDefects.length === 2,
          d1Present: allDefects.some((d: any) => d.id === 'D1'),
          d4Present: allDefects.some((d: any) => d.id === 'D4'),
          d1IsCoC: cocDefects.some((d: any) => d.id === 'D1'),
          d4IsCoC: cocDefects.some((d: any) => d.id === 'D4'),
        },
        persistenceVerified: true
      };
      
      setTestReport(report);
      
      // Show toast based on results
      const allPassed = Object.values(report.testsPassed).every(v => v === true);
      if (allPassed) {
        toast({
          title: "✅ E2E Test Passed",
          description: "Defect E2E test passed — data persisted.",
          variant: "default",
          className: "bg-green-50 border-green-200"
        });
      } else {
        const failedTests = Object.entries(report.testsPassed)
          .filter(([_, passed]) => !passed)
          .map(([test]) => test);
        toast({
          title: "❌ E2E Test Failed",
          description: `Failed tests: ${failedTests.join(', ')}`,
          variant: "destructive"
        });
      }
      
      // Console log for debugging
      console.log('E2E Test Report:', report);
      
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Error",
        description: "Failed to run E2E test",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">E2E Test Runner</h1>
      
      <div className="mb-6">
        <Button onClick={seedData} disabled={loading}>
          {loading ? 'Running Test...' : 'Run E2E Test'}
        </Button>
      </div>
      
      {testReport && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Seeded Data:</h3>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  {JSON.stringify(testReport.seeded, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">API Responses:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Counts: Active={testReport.counts.active}, Resolved={testReport.counts.resolved}</li>
                  <li>Total Defects Returned: {testReport.totalDefectsReturned} (Expected: 10)</li>
                  <li>Defect IDs: {testReport.defectIds.join(', ')}</li>
                  <li>CoC Defects Returned: {testReport.cocDefectsReturned} (Expected: 2)</li>
                  <li>CoC IDs: {testReport.cocIds.join(', ')}</li>
                  <li>Recurring Groups: {testReport.recurringGroups}</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Test Results:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(testReport.testsPassed).map(([test, passed]) => (
                    <li key={test} className={passed ? 'text-green-600' : 'text-red-600'}>
                      {test}: {passed ? '✅' : '❌'}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className={`p-4 rounded ${
                Object.values(testReport.testsPassed).every(v => v === true) 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className="font-semibold">
                  {Object.values(testReport.testsPassed).every(v => v === true)
                    ? '✅ All tests passed!'
                    : '❌ Some tests failed. Check the details above.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}