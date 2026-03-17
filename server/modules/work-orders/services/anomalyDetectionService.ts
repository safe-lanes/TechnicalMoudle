import { storage } from '../../../storage';
import { invalidateComplianceCache } from './complianceAnomalyService';
import type { WorkOrder, InsertWorkOrderAnomaly } from '@shared/schema';

interface CompletionData {
  dateOfCompletion?: string;
  runningHours?: string;
  performedBy?: string;
  [key: string]: any;
}

type AnomalyType = 'BACKDATING' | 'MISSED_CYCLES' | 'SUSPICIOUS_PATTERN' | 'MULTIPLE_ANOMALIES';
type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

function calculateDaysLate(dueDate: string | null | undefined, completionDate: string | null | undefined): number {
  if (!dueDate || !completionDate) return 0;
  const due = new Date(dueDate);
  const comp = new Date(completionDate);
  if (isNaN(due.getTime()) || isNaN(comp.getTime())) return 0;
  const diffMs = comp.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateBackdatingDays(completionDate: string | null | undefined, submittedDate?: string | null): number {
  if (!completionDate) return 0;
  const comp = new Date(completionDate);
  if (isNaN(comp.getTime())) return 0;
  const reference = submittedDate ? new Date(submittedDate) : new Date();
  if (isNaN(reference.getTime())) return 0;
  const diffMs = reference.getTime() - comp.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function determineSeverity(daysLate: number, missedCycles: number, backdatingDays: number): Severity {
  if (missedCycles >= 3 || daysLate >= 21 || backdatingDays >= 7) return 'HIGH';
  if (missedCycles >= 2 || daysLate >= 14 || backdatingDays >= 3) return 'MEDIUM';
  return 'LOW';
}

export async function detectAndLogAnomalies(
  workOrder: WorkOrder,
  completionData: CompletionData,
  missedCycles: number = 0
): Promise<void> {
  try {
    const completionDate = completionData.dateOfCompletion || workOrder.completionDateTime || workOrder.dateCompleted;
    const dueDate = workOrder.dueDate;
    const daysLate = calculateDaysLate(dueDate, completionDate);
    const submittedDate = (workOrder as any).submittedDate || (workOrder as any).updatedAt;
    const backdatingDays = calculateBackdatingDays(completionDate, submittedDate);

    const anomalyTypes: AnomalyType[] = [];

    if (backdatingDays >= 1) {
      anomalyTypes.push('BACKDATING');
    }

    if (missedCycles >= 1) {
      anomalyTypes.push('MISSED_CYCLES');
    }

    let patternInfo: { hasPattern: boolean; patternDescription: string; relatedWorkOrders: string[] } = {
      hasPattern: false,
      patternDescription: '',
      relatedWorkOrders: [],
    };

    if (workOrder.componentCode && workOrder.vesselId) {
      try {
        const allWOs = await storage.getWorkOrders(workOrder.vesselId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentSameComponent = allWOs.filter((wo: WorkOrder) => {
          if (wo.componentCode !== workOrder.componentCode) return false;
          if (wo.status !== 'Completed') return false;
          if (wo.id === workOrder.id) return false;
          const compDate = wo.completionDateTime || wo.dateCompleted;
          if (!compDate) return false;
          const d = new Date(compDate);
          return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
        });

        const backdatedRecent = recentSameComponent.filter((wo: WorkOrder) => {
          const compDate = wo.completionDateTime || wo.dateCompleted;
          if (!compDate) return false;
          const submittedDate = (wo as any).submittedDate || (wo as any).updatedAt;
          if (!submittedDate) return false;
          const comp = new Date(compDate);
          const submitted = new Date(submittedDate);
          if (isNaN(comp.getTime()) || isNaN(submitted.getTime())) return false;
          const gapDays = Math.floor((submitted.getTime() - comp.getTime()) / (1000 * 60 * 60 * 24));
          return gapDays >= 1;
        });

        if (backdatedRecent.length >= 2) {
          anomalyTypes.push('SUSPICIOUS_PATTERN');
          patternInfo = {
            hasPattern: true,
            patternDescription: `${backdatedRecent.length + 1} backdated entries for same component in last 30 days`,
            relatedWorkOrders: backdatedRecent.map((wo: WorkOrder) => wo.workOrderNo || wo.id).filter(Boolean) as string[],
          };
        }
      } catch (patternError) {
        console.error('[AnomalyDetection] Pattern detection error:', patternError);
      }
    }

    if (daysLate < 7 && missedCycles === 0 && backdatingDays === 0 && !patternInfo.hasPattern) {
      return;
    }

    if (anomalyTypes.length === 0 && daysLate < 7) {
      return;
    }

    if (anomalyTypes.length === 0 && daysLate >= 7) {
      anomalyTypes.push('MISSED_CYCLES');
    }

    const finalAnomalyType: AnomalyType = anomalyTypes.length > 1 ? 'MULTIPLE_ANOMALIES' : anomalyTypes[0];
    const severity = determineSeverity(daysLate, missedCycles, backdatingDays);

    const anomalyDetails = {
      backdatingInfo: {
        hasBackdating: backdatingDays >= 1,
        daysBackdated: backdatingDays,
        backdatedDate: completionDate || null,
      },
      missedCyclesInfo: {
        hasMissedCycles: missedCycles >= 1,
        cyclesSkipped: missedCycles,
        expectedCompletionDate: dueDate || null,
        actualCompletionDate: completionDate || null,
      },
      patternInfo,
      allAnomalyTypes: anomalyTypes,
    };

    const anomalyRecord: InsertWorkOrderAnomaly = {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.workOrderNo || workOrder.id,
      componentCode: workOrder.componentCode || null,
      componentName: workOrder.component || null,
      jobTitle: workOrder.jobTitle || null,
      vesselId: workOrder.vesselId || null,
      anomalyType: finalAnomalyType,
      severity,
      detectedAt: new Date(),
      completionDate: completionDate || null,
      dueDate: dueDate || null,
      daysLate,
      missedCycles,
      anomalyDetails,
      status: 'PENDING_REVIEW',
      isResolved: false,
    };

    await storage.createWorkOrderAnomaly(anomalyRecord);
    console.log(`[AnomalyDetection] ${severity} anomaly logged for WO ${workOrder.workOrderNo}: ${anomalyTypes.join(', ')}`);

    if (severity === 'HIGH') {
      try {
        const existingNotifs = await storage.getAllSuperintendentNotifications();
        const canonicalWoId = (workOrder as any).wouuid || workOrder.id;
        const hasDuplicate = existingNotifs.find((n: any) => n.workOrderId === canonicalWoId && !n.isAcknowledged);
        if (hasDuplicate) {
          console.log(`[AnomalyDetection] Superintendent notification already exists for WO ${workOrder.workOrderNo}, skipping duplicate`);
        } else {
          let vesselName = workOrder.vesselId || '';
          if (vesselName) {
            try {
              const vessels = await storage.getVessels();
              const vessel = vessels.find((v: any) => v.id === vesselName || v.vuuid === vesselName);
              if (vessel?.name) vesselName = vessel.name;
            } catch {}
          }
          await storage.createSuperintendentNotification({
            workOrderId: canonicalWoId,
            workOrderCode: workOrder.workOrderNo || workOrder.id,
            jobTitle: workOrder.jobTitle || 'Unknown Job',
            componentName: workOrder.component || workOrder.componentCode || 'Unknown',
            vesselName,
            daysLate,
            missedCycles,
            backdatingDays,
            approvalTier: 'anomaly_detection',
            isAcknowledged: false,
          });
          console.log(`[AnomalyDetection] Superintendent notification created for HIGH severity anomaly on WO ${workOrder.workOrderNo} (vessel: ${vesselName})`);
        }
      } catch (notifError) {
        console.error('[AnomalyDetection] Failed to create superintendent notification:', notifError);
      }
    }

    invalidateComplianceCache();
  } catch (error) {
    console.error('[AnomalyDetection] Failed to detect/log anomalies:', error);
  }
}
