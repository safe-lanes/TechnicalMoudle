import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ensureArray } from '../../shared/jsonHelpers';
import { calculateMissedCycles as calcMissedCyclesShared, calculateMissedCyclesRH } from '@shared/dateUtils';
import { detectAndLogAnomalies } from './anomalyDetectionService';
import { invalidateComplianceCache } from './complianceAnomalyService';
import { validateRHEntry } from '../../running-hours/services/rhTimelineValidationService';
import { logFieldChanges } from '../../sync';
import { isShipInstance } from '../../sync/syncRole';

// ── Complete Work Order ──

export async function completeWorkOrder(
  workOrderId: string,
  body: {
    runningHours?: string;
    dateOfCompletion?: string;
    approverUserId?: string;
    performedBy?: string;
    approver?: string;
    approvalDate?: string;
    workDone?: string;
    sparesUsed?: any;
    remarks?: string;
    userRole?: string;
    adminOverride?: boolean;
    userId?: string;
    userUuid?: string;
    [key: string]: any;
  }
) {
  const {
    runningHours,
    dateOfCompletion,
    approverUserId,
    userRole,
    adminOverride,
    userId: bodyUserId,
    userUuid: bodyUserUuid,
    woCompletionRh: bodyWoCompletionRh,
    currentReadingDate: bodyCurrentReadingDate,
    ...executionData
  } = body;

  // RH accuracy (migration 139):
  //  - woCompletionRh (Section B2.1 "WO Completion RH") = reading AT completion —
  //    drives the NEXT RH cycle + missed-cycles. Fallback to the Section B3
  //    Current Reading reproduces pre-feature behaviour for old/in-flight WOs.
  //  - currentReadingDate (Section B3) = date the reading was TAKEN — threads into
  //    the RH module so last_updated/audit reflect the reading date, not the WO
  //    completion date.
  const woCompletionRh: string | null =
    bodyWoCompletionRh !== undefined && bodyWoCompletionRh !== null && String(bodyWoCompletionRh).trim() !== ''
      ? String(bodyWoCompletionRh)
      : null;
  const currentReadingDate: string | null =
    bodyCurrentReadingDate ? String(bodyCurrentReadingDate) : null;
  // Effective source for next-cycle math (R1 fallback chain).
  const cycleRH: string | undefined = woCompletionRh ?? runningHours;
  const completionWarnings: string[] = [];

  // Get work order and component context
  const workOrder = await repo.findById(workOrderId);
  if (!workOrder) {
    throw new NotFoundError('Work order not found');
  }

  // Try multiple methods to find the component:
  // 1. By ID (workOrder.component might be an ID for some work orders)
  // 2. By component code + vessel (most reliable for auto-generated WOs)
  // 3. By component name + vessel (fallback for legacy WOs)
  let component = await repo.findComponent(workOrder.component);

  if (!component && workOrder.componentCode && workOrder.vesselId) {
    // Try lookup by component code
    const componentByCode = await repo.findComponentByCode(workOrder.componentCode, workOrder.vesselId);
    if (componentByCode) {
      // VALIDATION: Ensure component name matches to prevent wrong component linkage
      if (componentByCode.name === workOrder.component) {
        component = componentByCode;
        console.log(`📋 Found component by code ${workOrder.componentCode} for vessel ${workOrder.vesselId}`);
      } else {
        console.warn(`⚠️ Component code ${workOrder.componentCode} found but name mismatch: "${componentByCode.name}" vs "${workOrder.component}". Will try name lookup.`);
      }
    }
  }

  if (!component && workOrder.vesselId) {
    // Fallback: Search by component name
    const vesselComponents = await repo.findComponents(workOrder.vesselId);
    // Prioritize exact name match first
    component = vesselComponents.find((c: any) => c.name === workOrder.component) ?? undefined;
    // If no name match, try component code match
    if (!component) {
      component = vesselComponents.find((c: any) => c.componentCode === workOrder.componentCode) ?? undefined;
    }
    if (component) {
      console.log(`📋 Found component by name/code match: ${component.name}`);
    }
  }

  if (!component) {
    throw new NotFoundError(`Component not found: ${workOrder.component} (code: ${workOrder.componentCode})`);
  }

  // Rule #19: Multi-Department Approver Validation
  if (approverUserId && workOrder.jobId) {
    try {
      const job = await repo.findJob(workOrder.jobId);
      if (job && job.department) {
        const approver = await repo.findUser(approverUserId);
        if (approver && (approver as any).department && (approver as any).department !== job.department) {
          throw new ValidationError(
            `Approver department mismatch: Approver belongs to "${(approver as any).department}" but job requires "${job.department}" department authorization.`,
            { code: 'DEPARTMENT_MISMATCH' }
          );
        }
        console.log(`[RULE #19] Department validation passed: Approver (${(approver as any)?.department || 'no dept'}) can approve job in ${job.department} department`);
      }
    } catch (deptError: any) {
      if (deptError instanceof ValidationError) throw deptError;
      console.warn('[RULE #19] Department validation skipped due to error:', deptError);
    }
  }

  // Enforce running hours requirement only for RH-driven completions (Task #245):
  // NOT_RH_DRIVEN components treat running hours as not applicable — never required, never blocking.
  const counterType = (component.rhCounterType || 'MASTER').toUpperCase();
  if (workOrder.maintenanceBasis === 'Running Hours' && counterType !== 'NOT_RH_DRIVEN' && !runningHours) {
    throw new ValidationError('Running hours is required for RH-based maintenance work orders');
  }

  // ── RH accuracy validations (migration 139) ──
  // BLOCK: completion RH cannot exceed the current reading — the machine cannot
  // have had MORE hours at job completion than its latest meter reading.
  if (woCompletionRh && runningHours) {
    const woRhNum = parseFloat(woCompletionRh);
    const readingNum = parseFloat(runningHours);
    if (!isNaN(woRhNum) && !isNaN(readingNum) && woRhNum > readingNum) {
      throw new ValidationError(
        `WO Completion RH (${woRhNum}) cannot be greater than the Current Reading (${readingNum}). ` +
        `The completion reading is the hours at the time the work was done; the Current Reading is the latest meter value.`,
        { code: 'WO_COMPLETION_RH_EXCEEDS_READING' }
      );
    }
  }
  // BLOCK: the reading date cannot be in the future.
  if (currentReadingDate) {
    const readingDateParsed = new Date(currentReadingDate);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    if (isNaN(readingDateParsed.getTime())) {
      throw new ValidationError('Current Reading Date is not a valid date.', { code: 'INVALID_READING_DATE' });
    }
    if (readingDateParsed.getTime() > todayEnd.getTime()) {
      throw new ValidationError('Current Reading Date cannot be in the future.', { code: 'READING_DATE_IN_FUTURE' });
    }
  }

  // === Layer 7: RH Reading Sync (Task #240) — branch by rhCounterType ===
  //  MASTER        → the completion reading is the source of truth: route it through
  //                  updateMasterRH() so the per-day rate cap + Sail Admin override apply and the
  //                  new value cascades to INHERITED children. The old flat "cannot exceed current
  //                  RH" ceiling is intentionally NOT applied (the cap now lives in updateMasterRH).
  //  INHERITED     → record this component's OWN maintenance cycle (last-done / next-due on the jobs
  //                  row, written further below). Never move the master counter.
  //  NOT_RH_DRIVEN → calendar/condition based: never write any RH value, skip RH validation entirely.
  let rhValidationDetails: any = null;
  let completionRHSource = 'MANUAL_ENTRY';
  let rhReadingApplied = false;
  let rhBackdatedSkipped = false;
  let rhBackdatedLatestRH: number | null = null;
  let rhBackdatedLatestRHDate: string | null = null;

  // SHIP-ONLY RH sync (Jeevan): the master RH counter advances on the ship/HOD approval, NEVER
  // office-side; INHERITED snapshots likewise originate on the ship and reach shore via sync.
  // NOTE: gated at this OUTER block — NOT the inner `if (counterType === 'MASTER')` at line ~142 —
  // because that block's bare `else` is the INHERITED branch, so gating there would mis-route a
  // shore MASTER reading into INHERITED validation/audit. This outer block has no else (closes
  // cleanly), so a shore instance simply skips RH sync and continues. updateMasterRH still runs on
  // the ship, so the shore mirrors via running_hours_audit sync (propagation untouched).
  // Task #394: the office may now advance the RH counter from WO completion, but ONLY for
  // vessels whose per-vessel office-RH-entry switch is ON (default OFF, fail closed). Ship
  // behaviour is unchanged; receiving-side latest-reading-wins guards are always on.
  const isShipForRhSync = await isShipInstance();
  let officeRhEntryAllowedCompletion = false;
  if (!isShipForRhSync && (workOrder.vesselId || component.vesselId)) {
    const { isOfficeRhEntryEnabled } = await import('./workOrderGenerationGate');
    officeRhEntryAllowedCompletion = await isOfficeRhEntryEnabled(workOrder.vesselId || component.vesselId || '');
  }
  if (runningHours && counterType !== 'NOT_RH_DRIVEN' && (isShipForRhSync || officeRhEntryAllowedCompletion)) {
    const newRH = parseInt(runningHours);
    const completionDateForValidation = dateOfCompletion || new Date().toISOString().split('T')[0];
    // R2 (migration 139): the RH MODULE operates on the date the reading was TAKEN.
    // Falls back to the completion date = exact pre-feature behaviour.
    const readingDateForRH = currentReadingDate || completionDateForValidation;
    // Task #394: an OFFICE RH entry must carry an explicit observed reading date — never
    // default to "now" (a wrong reading date poisons the latest-reading-wins comparator).
    if (!isShipForRhSync && !currentReadingDate && !dateOfCompletion) {
      throw new ValidationError(
        'Office RH entry requires the reading date (Current Reading Date or Date of Completion). Enter the date the counter was actually read.',
        { code: 'RH_READING_DATE_REQUIRED', workOrderNo: workOrder.workOrderNo }
      );
    }
    const componentVesselId = workOrder.vesselId || component.vesselId || 'V001';
    const previousRH = parseInt(component.currentCumulativeRH || '0');
    // Double-sync guard: if this WO's reading was already applied once, do not re-apply it on
    // re-save / replay (would double-advance the master counter).
    const alreadySynced = !!(workOrder as any).rhSyncedAt;

    // Task #245: the flat parent/master-exceedance ceiling is intentionally NOT applied here.
    // MASTER readings are governed by updateMasterRH (per-day cap + Sail-Admin override) and
    // INHERITED readings are governed solely by validateRHEntry timeline validation below.

    if (body.completionRHSource) {
      completionRHSource = body.completionRHSource;
    }

    if (counterType === 'MASTER') {
      // MASTER: advance the master counter and cascade to INHERITED children via updateMasterRH().
      // updateMasterRH owns the 25 hrs/day cap + canAdminOverride(role) check, so we do NOT run the
      // inline ceiling or validateRHEntry here (they would re-reject a reading the cap just accepted).
      if (alreadySynced) {
        console.log(`ℹ️ [RH Sync] WO ${workOrder.workOrderNo} already synced (rh_synced_at set) — skipping MASTER cascade (double-sync guard)`);
      } else {
        // Pre-flight: detect back-dated lower entry.
        // If the completion date predates the master's last RH update AND the entered RH is not
        // greater than the current master RH, skip the RH module write. The WO still completes
        // normally; the reading is saved for scheduling / next-due calculation only.
        const masterCurrentRH = parseFloat((component.rhCurrentMaster ?? component.currentCumulativeRH) || '0');
        if (newRH <= masterCurrentRH) {
          // Task #394: baseline from AUDIT HISTORY first (legacy component stamps may be
          // poisoned with entry/sync time); component stamp only as fallback.
          const { resolveRhBaselineDay } = await import('../../running-hours/rhEventComparator');
          const { getPool } = await import('../../../db');
          const masterUpdRaw: any = component.rhMasterUpdatedAt ?? (component.lastUpdated ? new Date(component.lastUpdated) : null);
          const stampFallback: Date | null = masterUpdRaw instanceof Date ? masterUpdRaw : (masterUpdRaw ? new Date(masterUpdRaw) : null);
          const masterUpdDate: Date | null = await resolveRhBaselineDay(
            await getPool(), component.cuuid,
            stampFallback && !isNaN(stampFallback.getTime()) ? stampFallback : null
          );
          if (masterUpdDate && !isNaN(masterUpdDate.getTime())) {
            const woCompletionDate = new Date(readingDateForRH);
            const masterDay = Date.UTC(masterUpdDate.getUTCFullYear(), masterUpdDate.getUTCMonth(), masterUpdDate.getUTCDate());
            const woDay = Date.UTC(woCompletionDate.getUTCFullYear(), woCompletionDate.getUTCMonth(), woCompletionDate.getUTCDate());
            if (woDay < masterDay) {
              rhBackdatedSkipped = true;
              rhBackdatedLatestRH = masterCurrentRH;
              rhBackdatedLatestRHDate = masterUpdDate.toISOString().split('T')[0];
              console.warn(`⚠️ [RH Sync] Back-dated lower MASTER entry: WO ${workOrder.workOrderNo} entered RH ${newRH} (reading date ${readingDateForRH}) is older and lower than master current ${masterCurrentRH} (${rhBackdatedLatestRHDate}). RH module NOT updated — reading saved to WO for scheduling only.`);
            }
          }
        }

        if (!rhBackdatedSkipped) {
          // Task #394/#243: atomic compare-and-set claim on rh_synced_at — a concurrent or
          // replayed completion of the SAME WO sees 0 rows and skips (no double-advance).
          // Released on failure so a corrected retry can apply.
          const { claimWoRhSync, releaseWoRhSync } = await import('../../running-hours/rhEventComparator');
          const { getPool: getClaimPool } = await import('../../../db');
          const claimPool = await getClaimPool();
          if (!(await claimWoRhSync(claimPool, workOrder.wouuid))) {
            console.warn(`⚠️ [RH Sync] WO ${workOrder.workOrderNo} RH already claimed/applied by a concurrent completion — skipping duplicate RH advance`);
          } else {
          const { updateMasterRH } = await import('../../running-hours/services/runningHoursService');
          try {
            await updateMasterRH(component.cuuid, {
              newRHValue: newRH,
              updateSource: 'MANUAL',
              userId: bodyUserId || executionData.performedBy || 'system',
              userUuid: bodyUserUuid,
              userRole: userRole || 'Ship',
              adminOverride: adminOverride || false,
              comments: `RH update via work order completion ${workOrder.workOrderNo} (${workOrder.templateCode || ''})`,
              dateUpdated: readingDateForRH
            });
            rhReadingApplied = true;
            console.log(`✅ [RH Sync] MASTER component ${component.componentCode || component.cuuid} advanced to ${newRH} via WO ${workOrder.workOrderNo} (cascaded to INHERITED children)`);
          } catch (masterErr: any) {
            // Release the claim so a corrected retry can apply RH (Task #243 contract).
            await releaseWoRhSync(claimPool, workOrder.wouuid);
            // Surface the per-day cap / override-required error so the UI can offer a Sail Admin override.
            if (masterErr instanceof ValidationError) {
              const det: any = masterErr.details || {};
              throw new ValidationError(masterErr.message, {
                code: 'RH_OVERRIDE_REQUIRED',
                ...det,
                requiresAdminOverride: det.validation?.requiresAdminOverride ?? true,
                canOverride: det.validation?.canOverride ?? false,
                componentId: component.cuuid,
                componentCode: component.componentCode || workOrder.componentCode,
                rhCounterType: 'MASTER'
              });
            }
            throw masterErr;
          }
          } // end claim else — MASTER branch
        }
      }
    } else {
      // INHERITED: route through the master propagation path so the 25 hrs/day cap, decrease
      // rejection, cascade to all sibling INHERITED components, and WO completion date stamp all
      // apply exactly as they do for a MASTER WO completion.
      // Fallback: if the master link is missing or resolves to no MASTER component, record only
      // on this child (timeline-validated) and do not block completion (safe fallback per design).
      if (!alreadySynced) {
        const vesselIdForLookup = workOrder.vesselId || component.vesselId;
        let masterComp: any = null;

        if (component.rhMasterComponentId && vesselIdForLookup) {
          const allVesselComps = await repo.findComponents(vesselIdForLookup);
          masterComp = allVesselComps.find((c: any) =>
            c.rhCounterType === 'MASTER' && (
              c.cuuid === component.rhMasterComponentId ||
              String(c.id) === component.rhMasterComponentId ||
              c.componentCode === component.rhMasterComponentId
            )
          ) ?? null;
        }

        if (masterComp) {
          // INHERITED pre-flight: detect back-dated lower entry against the master component.
          const inhMasterCurrentRH = parseFloat((masterComp.rhCurrentMaster ?? masterComp.currentCumulativeRH) || '0');
          if (newRH <= inhMasterCurrentRH) {
            // Task #394: audit-history baseline first; component stamp only as fallback.
            const { resolveRhBaselineDay } = await import('../../running-hours/rhEventComparator');
            const { getPool } = await import('../../../db');
            const inhMasterUpdRaw: any = masterComp.rhMasterUpdatedAt ?? (masterComp.lastUpdated ? new Date(masterComp.lastUpdated) : null);
            const inhStampFallback: Date | null = inhMasterUpdRaw instanceof Date ? inhMasterUpdRaw : (inhMasterUpdRaw ? new Date(inhMasterUpdRaw) : null);
            const inhMasterUpdDate: Date | null = await resolveRhBaselineDay(
              await getPool(), masterComp.cuuid,
              inhStampFallback && !isNaN(inhStampFallback.getTime()) ? inhStampFallback : null
            );
            if (inhMasterUpdDate && !isNaN(inhMasterUpdDate.getTime())) {
              const woCompletionDate = new Date(readingDateForRH);
              const masterDay = Date.UTC(inhMasterUpdDate.getUTCFullYear(), inhMasterUpdDate.getUTCMonth(), inhMasterUpdDate.getUTCDate());
              const woDay = Date.UTC(woCompletionDate.getUTCFullYear(), woCompletionDate.getUTCMonth(), woCompletionDate.getUTCDate());
              if (woDay < masterDay) {
                rhBackdatedSkipped = true;
                rhBackdatedLatestRH = inhMasterCurrentRH;
                rhBackdatedLatestRHDate = inhMasterUpdDate.toISOString().split('T')[0];
                console.warn(`⚠️ [RH Sync] Back-dated lower INHERITED entry: WO ${workOrder.workOrderNo} entered RH ${newRH} (reading date ${readingDateForRH}) is older and lower than master ${masterComp.componentCode || masterComp.cuuid} current ${inhMasterCurrentRH} (${rhBackdatedLatestRHDate}). RH module NOT updated — reading saved to WO for scheduling only.`);
              }
            }
          }

          if (!rhBackdatedSkipped) {
          // Master resolved: advance its counter, which cascades the delta to every sibling
          // INHERITED component and stamps them all with the WO completion date.
          // Task #394/#243: atomic claim — same double-advance protection as the MASTER branch.
          const { claimWoRhSync: claimInh, releaseWoRhSync: releaseInh } = await import('../../running-hours/rhEventComparator');
          const { getPool: getPoolInh } = await import('../../../db');
          const claimPoolInh = await getPoolInh();
          if (!(await claimInh(claimPoolInh, workOrder.wouuid))) {
            console.warn(`⚠️ [RH Sync] WO ${workOrder.workOrderNo} RH already claimed/applied by a concurrent completion — skipping duplicate RH advance (INHERITED)`);
          } else {
          const { updateMasterRH } = await import('../../running-hours/services/runningHoursService');
          try {
            await updateMasterRH(masterComp.cuuid, {
              newRHValue: newRH,
              updateSource: 'WORKORDER',
              userId: bodyUserId || executionData.performedBy || 'system',
              userUuid: bodyUserUuid,
              userRole: userRole || 'Ship',
              adminOverride: adminOverride || false,
              comments: `WO ${workOrder.workOrderNo} (INHERITED → cascaded via master ${masterComp.componentCode || masterComp.cuuid})`,
              dateUpdated: readingDateForRH
            });
            console.log(`✅ [RH Sync] INHERITED component ${component.componentCode || component.cuuid} routed through MASTER ${masterComp.componentCode || masterComp.cuuid}, cascaded to all siblings via WO ${workOrder.workOrderNo}`);
          } catch (masterErr: any) {
            // Release the claim so a corrected retry can apply RH (Task #243 contract).
            await releaseInh(claimPoolInh, workOrder.wouuid);
            if (masterErr instanceof ValidationError) {
              const det: any = masterErr.details || {};
              throw new ValidationError(masterErr.message, {
                code: 'RH_OVERRIDE_REQUIRED',
                ...det,
                requiresAdminOverride: det.validation?.requiresAdminOverride ?? true,
                canOverride: det.validation?.canOverride ?? false,
                componentId: masterComp.cuuid,
                componentCode: masterComp.componentCode || workOrder.componentCode,
                rhCounterType: 'INHERITED'
              });
            }
            throw masterErr;
          }
          } // end claim else — INHERITED branch
          } // end if (!rhBackdatedSkipped) — INHERITED branch
        } else {
          // No valid master link: timeline-validate and record on this child only.
          const validation = await validateRHEntry(component.cuuid, readingDateForRH, newRH);
          if (!validation.isValid) {
            throw new ValidationError(validation.errorMessage, {
              code: validation.validationStatus,
              validRange: validation.validRange,
              previousEntry: validation.previousEntry,
              nextEntry: validation.nextEntry,
              utilizationRate: validation.utilizationRate,
              daysBetweenPrevious: validation.daysBetweenPrevious,
              daysBetweenNext: validation.daysBetweenNext,
              maxPossibleIncrease: validation.maxPossibleIncrease,
              actualIncrease: validation.actualIncrease
            });
          }
          if (validation.requiresJustification && !body.rhJustification) {
            throw new ValidationError(
              `High machinery utilization detected (${validation.utilizationRate.toFixed(1)} hrs/day). Justification is required.`,
              { code: 'HIGH_UTILIZATION', validRange: validation.validRange, utilizationRate: validation.utilizationRate, requiresJustification: true }
            );
          }
          rhValidationDetails = {
            isValid: validation.isValid,
            validationDate: new Date().toISOString(),
            validRange: validation.validRange,
            utilizationRate: validation.utilizationRate,
            requiresJustification: validation.requiresJustification,
            validationErrors: validation.anomalyFlags
          };
          await repo.createRunningHoursAudit({
            componentId: component.cuuid,
            vesselId: componentVesselId,
            previousRH: previousRH.toString(),
            newRH: newRH.toString(),
            cumulativeRH: newRH.toString(),
            dateUpdatedLocal: readingDateForRH,
            dateUpdatedTZ: 'UTC',
            enteredAtUTC: new Date(),
            userId: executionData.performedBy || 'System',
            source: 'workorder',
            notes: `WO ${workOrder.workOrderNo} (INHERITED — no master link, child-only record)`,
            meterReplaced: false
          });
          console.warn(`⚠️ [RH Sync] INHERITED component ${component.componentCode || component.cuuid} has no valid master link — recorded on child only (WO ${workOrder.workOrderNo})`);
        }
      }
      if (!rhBackdatedSkipped) {
        rhReadingApplied = true;
      }
    }
  }

  let missedCycles: number;
  if (workOrder.maintenanceBasis === 'Running Hours' && cycleRH) {
    // R1 (migration 139): missed-cycles measures intervals elapsed AT THE MOMENT
    // THE WORK WAS DONE — the WO Completion RH (fallback: Current Reading, which
    // reproduces pre-feature behaviour exactly).
    const completionRHValue = parseInt(cycleRH);
    const dueRH = workOrder.nextDueReading ? parseFloat(workOrder.nextDueReading) : null;
    let jobIntervalRH: number | null = null;
    let prevLastDoneRH: number | null = null;
    if (workOrder.jobId) {
      const jobForRH = await repo.findJob(workOrder.jobId);
      if (jobForRH?.intervalRunningHour) {
        jobIntervalRH = jobForRH.intervalRunningHour;
      }
      const prevRaw = (jobForRH as any)?.lastDoneRH;
      if (prevRaw !== undefined && prevRaw !== null && String(prevRaw).trim() !== '') {
        const parsedPrev = parseFloat(String(prevRaw));
        if (!isNaN(parsedPrev)) prevLastDoneRH = parsedPrev;
      }
    }
    if (!jobIntervalRH && workOrder.frequencyValue) {
      jobIntervalRH = parseInt(String(workOrder.frequencyValue));
    }
    // WARN-ONLY (Jeevan's call): completion RH below the previous completion's
    // lastDoneRH is suspicious but allowed — it still field-logs for audit.
    if (woCompletionRh && prevLastDoneRH !== null && !isNaN(completionRHValue) && completionRHValue < prevLastDoneRH) {
      const warnMsg = `WO Completion RH (${completionRHValue}) is below the previous completion's RH (${prevLastDoneRH}) for this job — saved as entered; please verify the reading.`;
      completionWarnings.push(warnMsg);
      console.warn(`⚠️ [RH Accuracy] ${warnMsg} (WO ${workOrder.workOrderNo})`);
    }
    missedCycles = calculateMissedCyclesRH(dueRH, completionRHValue, jobIntervalRH);
    if (missedCycles > 0) {
      console.log(`⚠️ Skipped cycle detection (RH): ${missedCycles} cycle(s) missed for WO ${workOrder.workOrderNo} (dueRH: ${dueRH}, cycleRH: ${completionRHValue}${woCompletionRh ? ' [woCompletionRh]' : ' [currentReading fallback]'}, interval: ${jobIntervalRH})`);
    }
  } else if (workOrder.maintenanceBasis === 'Dual Frequency') {
    // Dual Frequency: use calendar missed cycles (calendar leg is always present)
    // D2: If RH entered, RH leg also updated; if not, RH unchanged
    let dualCalendarDueDate = workOrder.nextDueDate || workOrder.dueDate || null;
    if (!dualCalendarDueDate && workOrder.jobId) {
      const jobForDualDue = await repo.findJob(workOrder.jobId);
      if (jobForDualDue?.nextDueDate) {
        dualCalendarDueDate = jobForDualDue.nextDueDate;
      }
    }
    missedCycles = calcMissedCyclesShared(
      dualCalendarDueDate,
      dateOfCompletion,
      workOrder.frequencyValue,
      workOrder.frequencyUnit
    );
    if (missedCycles > 0) {
      console.log(`⚠️ Skipped cycle detection (Dual/Calendar): ${missedCycles} cycle(s) missed for WO ${workOrder.workOrderNo}`);
    }
    if (dualCalendarDueDate && !workOrder.nextDueDate) {
      (workOrder as any).nextDueDate = dualCalendarDueDate;
    }
  } else {
    let calendarDueDate = workOrder.nextDueDate || workOrder.dueDate || null;
    // Legacy WOs may have no nextDueDate stored on the record — fall back to the job's current nextDueDate
    if (!calendarDueDate && workOrder.jobId) {
      const jobForDueDate = await repo.findJob(workOrder.jobId);
      if (jobForDueDate?.nextDueDate) {
        calendarDueDate = jobForDueDate.nextDueDate;
        console.log(`[MissedCycles] WO ${workOrder.workOrderNo} has no nextDueDate — falling back to job nextDueDate: ${calendarDueDate}`);
      }
    }
    missedCycles = calcMissedCyclesShared(
        calendarDueDate,
        dateOfCompletion,
        workOrder.frequencyValue,
        workOrder.frequencyUnit
      );
    if (missedCycles > 0) {
      console.log(`⚠️ Skipped cycle detection: ${missedCycles} cycle(s) missed for WO ${workOrder.workOrderNo} (due: ${calendarDueDate}, completed: ${dateOfCompletion})`);
    }
    // Overwrite so originalDueDate below picks up the resolved due date
    if (calendarDueDate && !workOrder.nextDueDate) {
      (workOrder as any).nextDueDate = calendarDueDate;
    }
  }

  const originalDueDate = workOrder.nextDueDate || workOrder.dueDate || null;

  const updatedWorkOrder = await repo.update(workOrderId, {
    ...executionData,
    runningHoursAtCompletion: runningHours ? parseInt(runningHours) : undefined,
    dateCompleted: dateOfCompletion,
    status: 'Completed',
    missedCycles,
    originalDueDate,
    completionRH: runningHours ? runningHours : undefined,
    // RH accuracy (migration 139): persist the completion-time RH + reading date.
    woCompletionRh: woCompletionRh ?? undefined,
    currentReadingDate: currentReadingDate ?? undefined,
    completionRHValidated: runningHours ? true : undefined,
    completionRHSource: runningHours ? completionRHSource : undefined,
    completionRHValidationDetails: rhValidationDetails || undefined,
    rhJustification: body.rhJustification || undefined,
    rhJustificationProvidedBy: body.rhJustification ? (executionData.performedBy || 'System') : undefined,
    rhJustificationDate: body.rhJustification ? new Date() : undefined,
    // Double-sync guard: stamp when a completion reading was applied this run (MASTER cascade or
    // INHERITED cycle). Leaves an existing stamp intact on replay.
    rhSyncedAt: rhReadingApplied ? new Date() : undefined,
    rhBackdatedEntry: rhBackdatedSkipped ? true : undefined
  });

  // Sync field logging — log completion UPDATE
  try {
    await logFieldChanges('work_orders', workOrder.wouuid, workOrder.vesselId || null, workOrder, updatedWorkOrder, executionData.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WO complete:', err); }

  // Auto-populate component_maintenance_history
  try {
    const existingHistory = await repo.findMaintenanceHistoryByWorkOrderId(workOrder.wouuid);
    if (existingHistory) {
      console.log(`⚠️ Maintenance history already exists for work order ${workOrder.id}, skipping duplicate creation`);
    } else {
      const normalizeToISO = (isoDate: string | undefined): string => {
        if (!isoDate) return new Date().toISOString().split('T')[0];
        const date = new Date(isoDate);
        return date.toISOString().split('T')[0];
      };

      // Get job information for proper job linkage
      let parentJob: any = null;
      let parentJobNo: string | null = null;

      if (workOrder.jobId) {
        parentJob = await repo.findJob(workOrder.jobId);
        if (parentJob) parentJobNo = parentJob.jobNo;
      }

      // Fallback: Extract jobNo from work order number
      if (!parentJobNo && workOrder.workOrderNo) {
        const woNumber = workOrder.workOrderNo;
        const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
        if (newFormatMatch) {
          parentJobNo = newFormatMatch[1];
        }
        if (!parentJobNo) {
          const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
          if (oldFormatMatch) {
            parentJobNo = oldFormatMatch[1];
          }
        }
        if (parentJobNo && !parentJob) {
          const allJobs = await repo.findJobsByVessel(workOrder.vesselId as string);
          parentJob = allJobs.find((j: any) => j.jobNo === parentJobNo) || null;
        }
      }

      const historyPayload = {
        componentId: component.cuuid,
        componentCode: workOrder.componentCode || component.componentCode,
        vesselCode: workOrder.vesselId,
        jobId: parentJob?.juuid || parentJob?.id || workOrder.jobId || null,
        jobCode: parentJobNo || null,
        workOrderId: workOrder.wouuid,
        workOrderNo: workOrder.templateCode || `WO-${workOrder.id}`,
        jobTitle: workOrder.jobTitle,
        maintenanceType: workOrder.taskType || 'Servicing',
        dateCompleted: normalizeToISO(dateOfCompletion),
        runningHoursAtCompletion: runningHours || null,
        performedBy: executionData.performedBy || 'Unknown',
        approvedBy: executionData.approver || null,
        approvalDate: executionData.approvalDate ? normalizeToISO(executionData.approvalDate) : null,
        status: 'Approved' as const,
        workDescription: executionData.workDone || workOrder.briefWorkDescription || null,
        sparesUsed: executionData.sparesUsed || null,
        remarks: missedCycles >= 1
          ? `${missedCycles} cycles skipped — completed late${executionData.remarks ? '. ' + executionData.remarks : ''}`
          : (executionData.remarks || 'Completed on time'),
        isComponentReplaced: false,
        missedCycles,
        originalDueDate
      };

      await repo.createMaintenanceHistory(historyPayload);
      console.log(`✅ Auto-populated maintenance history for work order ${workOrder.id} (componentId: ${component.cuuid}, jobId: ${historyPayload.jobId}, jobCode: ${historyPayload.jobCode})`);
    }
  } catch (historyError) {
    console.error('Failed to create maintenance history record:', historyError);
  }

  if (missedCycles >= 1 && component) {
    try {
      if (workOrder.maintenanceBasis === 'Running Hours' && runningHours) {
        const { createSkippedCycleRecordsRH } = await import('../utils/skippedCycleBackfill');
        const completionRHValue = parseInt(runningHours);
        const dueRH = workOrder.nextDueReading ? parseFloat(workOrder.nextDueReading) : 0;
        let jobIntervalRH = 0;
        if (workOrder.jobId) {
          const jobForBackfill = await repo.findJob(workOrder.jobId);
          if (jobForBackfill?.intervalRunningHour) {
            jobIntervalRH = jobForBackfill.intervalRunningHour;
          }
        }
        if (!jobIntervalRH && workOrder.frequencyValue) {
          jobIntervalRH = parseInt(String(workOrder.frequencyValue));
        }
        await createSkippedCycleRecordsRH({
          workOrderId: workOrder.wouuid || workOrder.id,
          workOrderNo: workOrder.workOrderNo || null,
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode || null,
          vesselCode: workOrder.vesselId || component.vesselId || null,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.jobCode || null,
          jobTitle: workOrder.jobTitle || null,
          dueRH,
          completionRH: completionRHValue,
          intervalRH: jobIntervalRH,
          missedCycles
        });
      } else if (workOrder.maintenanceBasis === 'Dual Frequency') {
        // Dual Frequency: backfill using calendar leg (always present)
        const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
        await createSkippedCycleRecords({
          workOrderId: workOrder.wouuid || workOrder.id,
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode || null,
          vesselCode: workOrder.vesselId || component.vesselId || null,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.jobCode || null,
          jobTitle: workOrder.jobTitle || null,
          originalDueDate,
          missedCycles,
          frequencyValue: workOrder.frequencyValue,
          frequencyUnit: workOrder.frequencyUnit
        });
      } else if (workOrder.maintenanceBasis === 'Calendar') {
        const { createSkippedCycleRecords } = await import('../utils/skippedCycleBackfill');
        await createSkippedCycleRecords({
          workOrderId: workOrder.wouuid || workOrder.id,
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode || null,
          vesselCode: workOrder.vesselId || component.vesselId || null,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.jobCode || null,
          jobTitle: workOrder.jobTitle || null,
          originalDueDate,
          missedCycles,
          frequencyValue: workOrder.frequencyValue,
          frequencyUnit: workOrder.frequencyUnit
        });
      }
    } catch (err) {
      console.error('[BACKFILL ERROR] Failed to create skipped cycle records:', err);
    }
  }

  // Auto-update parent job's cycle fields
  try {
    let job: any = null;

    if (workOrder.jobId) {
      job = await repo.findJob(workOrder.jobId);
    }

    // Fallback: Extract jobNo from work order number
    if (!job && workOrder.workOrderNo) {
      const woNumber = workOrder.workOrderNo;
      let extractedJobNo: string | null = null;

      const newFormatMatch = woNumber.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
      if (newFormatMatch) {
        extractedJobNo = newFormatMatch[1];
      }

      if (!extractedJobNo) {
        const oldFormatMatch = woNumber.match(/^(.+)-\d{4}-\d+$/);
        if (oldFormatMatch) {
          extractedJobNo = oldFormatMatch[1];
        }
      }

      if (extractedJobNo) {
        const vesselId = workOrder.vesselId || component.vesselId;
        if (vesselId) {
          const jobs = await repo.findJobs(vesselId as string);
          job = jobs.find((j: any) => j.jobNo === extractedJobNo);
          if (job) {
            console.log(`📋 Found job ${job.jobNo} via work order number extraction (jobId was not linked)`);
          }
        }
      }
    }

    if (job) {
      // Cycle math extracted to the SHARED helper (jobCycleCalc) so the shore
      // completion-learning hook computes identical values from synced ship
      // completions. Semantics unchanged: Calendar/Dual/RH legs, D2 RH
      // conditionality, R1 completion-RH source — see the helper's header.
      const { computeJobCycleUpdates } = await import('@shared/workOrders/jobCycleCalc');
      const { jobUpdates, linkUpdates: calcLinkUpdates } = computeJobCycleUpdates({
        maintenanceBasis: workOrder.maintenanceBasis,
        dateOfCompletion,
        completionRH: cycleRH,
        originalDueDate,
        job,
      });
      const linkUpdates: any = { updatedAt: new Date(), ...calcLinkUpdates };

      const woComponentId = (workOrder as any).componentId || component.cuuid;

      if (workOrder.maintenanceBasis === 'Dual Frequency' && dateOfCompletion && !cycleRH) {
        console.log(`ℹ️ [Dual] No RH entered for job ${job.jobNo} — RH leg stays unchanged (D2)`);
      }

      if (Object.keys(jobUpdates).length > 0) {
        const updateVesselId = workOrder.vesselId || job.vesselId;
        if (woComponentId && updateVesselId) {
          await repo.updateJobComponentLinkTracking(updateVesselId, job.juuid, woComponentId, linkUpdates);
          console.log(`✅ Updated component-specific tracking for vessel ${updateVesselId}, job ${job.jobNo} + component ${woComponentId}`);
        }
        await repo.updateJob(job.juuid, jobUpdates);
        console.log(`✅ Updated ${workOrder.maintenanceBasis} job ${job.jobNo} cycle fields: ${JSON.stringify(jobUpdates)}`);
      }
    } else {
      console.warn(`⚠️ Could not find job to update for work order ${workOrder.workOrderNo}`);
    }
  } catch (jobUpdateError) {
    console.error('Failed to update job cycle fields:', jobUpdateError);
  }

  // Auto-deduct consumed spares from inventory
  const parsedConsumedSpares = ensureArray(workOrder.consumedSpareParts);
  if (parsedConsumedSpares.length > 0) {
    const consumedSpares = parsedConsumedSpares as Array<{
      partNo: string;
      partCode?: string;
      description?: string;
      quantityConsumed: number | string;
      locationId?: number | null;
      location?: string;
      locationName?: string;
      comments?: string;
    }>;

    for (const consumedSpare of consumedSpares) {
      const qtyConsumed = typeof consumedSpare.quantityConsumed === 'string'
        ? parseFloat(consumedSpare.quantityConsumed)
        : consumedSpare.quantityConsumed;

      if (qtyConsumed && qtyConsumed > 0) {
        try {
          const spares = await repo.findSpares(workOrder.vesselId || 'V001');

          let spare: any = null;

          // Step 1: Try partCode first
          if (consumedSpare.partCode) {
            spare = spares.find((s: any) => s.partCode === consumedSpare.partCode);
          }
          // Step 2: Try matching partNo against partCode
          if (!spare && consumedSpare.partNo) {
            spare = spares.find((s: any) => s.partCode === consumedSpare.partNo);
          }
          // Step 3: Try matching partNo against partNumber
          if (!spare && consumedSpare.partNo) {
            spare = spares.find((s: any) => s.partNumber === consumedSpare.partNo);
          }

          if (spare) {
            const vesselId = workOrder.vesselId || 'V001';
            let resolvedLocationId = consumedSpare.locationId ? parseInt(String(consumedSpare.locationId)) : null;

            const locationNameFallback = consumedSpare.location || consumedSpare.locationName;
            if ((!resolvedLocationId || isNaN(resolvedLocationId as number)) && locationNameFallback) {
              const locationObj = await repo.findOrCreateLocation(vesselId, locationNameFallback, 'system');
              if (locationObj) {
                resolvedLocationId = locationObj.id;
                console.log(`📍 [POST Complete] Resolved location name "${locationNameFallback}" to ID ${resolvedLocationId}`);
              }
            }

            if (resolvedLocationId && !isNaN(resolvedLocationId as number)) {
              try {
                await repo.performInventoryTransaction({
                  vesselId: vesselId,
                  spareId: spare.id,
                  spareUuid: spare.suuid,
                  locationId: resolvedLocationId,
                  eventType: 'CONSUME',
                  qtyChange: -Math.abs(qtyConsumed),
                  referenceType: 'WORK_ORDER',
                  referenceId: workOrder.wouuid,
                  referenceNote: `WO: ${workOrder.workOrderNo} - ${consumedSpare.comments || 'Consumed during work completion'}`
                });
                console.log(`✅ [Inventory Transaction] Consumed ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId} (WO: ${workOrder.workOrderNo})`);
              } catch (txnError: any) {
                if (txnError.message?.includes('INSUFFICIENT_STOCK') || txnError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
                  throw new Error(`INSUFFICIENT_STOCK: Cannot consume ${qtyConsumed} units of ${consumedSpare.partNo} from location ${resolvedLocationId}. Insufficient stock.`);
                }
                throw txnError;
              }
            } else {
              throw new Error(`LOCATION_REQUIRED: Spare part ${consumedSpare.partNo} requires a storage location for inventory tracking. Please select a location in the work order form.`);
            }
          } else {
            throw new Error(`SPARE_NOT_FOUND: Spare part ${consumedSpare.partCode || consumedSpare.partNo} was not found in inventory. Searched: partCode="${consumedSpare.partCode}", partNo="${consumedSpare.partNo}". Please verify the spare exists in the inventory.`);
          }
        } catch (spareError: any) {
          if (spareError.message?.includes('LOCATION_REQUIRED') ||
              spareError.message?.includes('SPARE_NOT_FOUND') ||
              spareError.message?.includes('INSUFFICIENT_STOCK') ||
              spareError.message?.includes('NEGATIVE_STOCK_PREVENTED')) {
            throw spareError;
          }
          console.error(`Failed to deduct spare ${consumedSpare.partNo}:`, spareError);
        }
      }
    }
  }

  try {
    await detectAndLogAnomalies(updatedWorkOrder, body, missedCycles);
  } catch (anomalyError) {
    console.error('[WorkOrderCompletion] Anomaly detection failed (non-blocking):', anomalyError);
  }

  invalidateComplianceCache();

  return {
    success: true,
    workOrder: updatedWorkOrder,
    runningHoursUpdated: !!runningHours,
    missedCycles,
    rhBackdated: rhBackdatedSkipped,
    // RH accuracy (migration 139): warn-only advisories (e.g. completion RH below
    // the previous completion) — saved as entered, surfaced for the UI to toast.
    ...(completionWarnings.length > 0 && { warnings: completionWarnings }),
    ...(rhBackdatedSkipped && {
      latestRH: rhBackdatedLatestRH,
      latestRHDate: rhBackdatedLatestRHDate
    })
  };
}

// ── Finalize Work Order Completion Side-Effects ───────────────────────────────
// Called when a WO transitions to Completed through a path that does NOT go
// through workOrderService.updateWorkOrder (e.g. reviewer-approve after L2
// review). Handles maintenance history creation, job cycle date updates, and
// spare consumption deduction. All operations are idempotent / non-throwing.
export async function finalizeWorkOrderCompletion(workOrderId: string): Promise<void> {
  const workOrder = await repo.findById(workOrderId);
  if (!workOrder) {
    console.error(`[Finalize] Work order ${workOrderId} not found`);
    return;
  }

  // ── 1. Resolve component ─────────────────────────────────────────────────
  let component: any = await repo.findComponent(workOrder.component);
  if (!component && workOrder.componentCode && workOrder.vesselId) {
    const byCode = await repo.findComponentByCode(workOrder.componentCode, workOrder.vesselId);
    if (byCode && byCode.name === workOrder.component) component = byCode;
  }
  if (!component && workOrder.vesselId) {
    const all = await repo.findComponents(workOrder.vesselId);
    component = all.find((c: any) => c.name === workOrder.component)
      ?? all.find((c: any) => c.componentCode === workOrder.componentCode)
      ?? null;
  }
  if (!component) {
    console.warn(`[Finalize] Could not find component for WO ${workOrder.workOrderNo} — skipping side-effects`);
    return;
  }

  const rawCompletionDate: string | null = workOrder.completionDateTime || workOrder.dateCompleted || null;
  const missedCycles: number = workOrder.missedCycles || 0;
  const originalDueDate: string | null = workOrder.originalDueDate || workOrder.nextDueDate || workOrder.dueDate || null;

  const normalizeToISO = (d: string): string | null => {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.split('T')[0];
    const m = d.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const p = new Date(d);
    return !isNaN(p.getTime()) ? p.toISOString().split('T')[0] : null;
  };

  // ── 2. Create maintenance history (idempotent) ───────────────────────────
  try {
    const existing = await repo.findMaintenanceHistoryByWorkOrderId(workOrder.wouuid);
    if (existing) {
      console.log(`⚠️ [Finalize] Maintenance history already exists for WO ${workOrder.workOrderNo}, skipping`);
    } else if (rawCompletionDate) {
      const dateOfCompletion = normalizeToISO(rawCompletionDate);
      if (dateOfCompletion) {
        await repo.createMaintenanceHistory({
          componentId: component.cuuid,
          componentCode: workOrder.componentCode || component.componentCode,
          vesselCode: workOrder.vesselId,
          jobId: workOrder.jobId || null,
          jobCode: workOrder.workOrderNo?.match(/^(.+?)-\d+\.\d+/)?.[1] || null,
          workOrderId: workOrder.wouuid,
          workOrderNo: workOrder.workOrderNo || `WO-${workOrder.id}`,
          jobTitle: workOrder.jobTitle,
          maintenanceType: (workOrder as any).maintenanceType || workOrder.taskType || 'Servicing',
          dateCompleted: dateOfCompletion,
          runningHoursAtCompletion: workOrder.runningHours || null,
          performedBy: workOrder.performedBy || (workOrder as any).executionAssignedTo || 'Unknown',
          approvedBy: workOrder.approver || null,
          approvalDate: dateOfCompletion,
          status: 'Approved' as const,
          workDescription: (workOrder as any).workCarriedOut || workOrder.briefWorkDescription || null,
          sparesUsed: workOrder.consumedSpareParts ? JSON.stringify(workOrder.consumedSpareParts) : null,
          remarks: missedCycles >= 1
            ? `${missedCycles} cycles skipped — completed late${workOrder.remarks ? '. ' + workOrder.remarks : ''}`
            : (workOrder.remarks || workOrder.jobExperienceNotes || 'Completed on time'),
          isComponentReplaced: false,
          missedCycles,
          originalDueDate,
        });
        console.log(`✅ [Finalize] Created maintenance history for WO ${workOrder.workOrderNo}`);
      }
    }
  } catch (err) {
    console.error('[Finalize] Failed to create maintenance history:', err);
  }

  // ── 3. Update job cycle dates ────────────────────────────────────────────
  try {
    let job: any = null;
    if (workOrder.jobId) job = await repo.findJob(workOrder.jobId);
    if (!job && workOrder.workOrderNo) {
      const m1 = workOrder.workOrderNo.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
      const m2 = workOrder.workOrderNo.match(/^(.+)-\d{4}-\d+$/);
      const extractedJobNo = m1 ? m1[1] : (m2 ? m2[1] : null);
      if (extractedJobNo && workOrder.vesselId) {
        const jobs = await repo.findJobs(workOrder.vesselId);
        job = jobs.find((j: any) => j.jobNo === extractedJobNo) || null;
      }
    }

    if (job && rawCompletionDate) {
      const dateOfCompletionNorm = normalizeToISO(rawCompletionDate);
      const basis = workOrder.maintenanceBasis;

      if ((basis === 'Calendar' || basis === 'Dual Frequency') && dateOfCompletionNorm) {
        const { calculateNextDueDate } = await import('@shared/dateUtils');
        const updates: any = { lastDoneDate: dateOfCompletionNorm };
        const linkUpdates: any = { lastDoneDate: dateOfCompletionNorm, updatedAt: new Date() };
        if (job.frequencyValue && job.frequencyUnit) {
          const nextDue = calculateNextDueDate(dateOfCompletionNorm, job.frequencyValue, job.frequencyUnit, originalDueDate);
          if (nextDue) { updates.nextDueDate = nextDue; linkUpdates.nextDueDate = nextDue; }
        }
        const vId = workOrder.vesselId || job.vesselId;
        if (component.cuuid && vId) {
          await repo.updateJobComponentLinkTracking(vId, job.juuid, component.cuuid, linkUpdates);
        }
        await repo.updateJob(job.juuid, updates);
        console.log(`✅ [Finalize] Updated calendar job ${job.jobNo} lastDoneDate: ${dateOfCompletionNorm}`);
      }

      // R1 (migration 139): next cycle derives from the stored WO Completion RH
      // (fallback: the stored reading = pre-feature behaviour for old rows).
      const finalizeCycleRH = (workOrder as any).woCompletionRh ?? workOrder.runningHours;
      if ((basis === 'Running Hours' || basis === 'Dual Frequency') && finalizeCycleRH) {
        const currentRH = parseInt(String(finalizeCycleRH));
        if (!isNaN(currentRH)) {
          const rhUpdates: any = { lastDoneRH: currentRH };
          const rhLinkUpdates: any = { lastDoneRH: currentRH.toString(), updatedAt: new Date() };
          const rhInterval = job.intervalRunningHour || (job.frequencyValue ? parseInt(job.frequencyValue) : null);
          if (rhInterval && !isNaN(rhInterval)) {
            rhUpdates.nextDueRH = currentRH + rhInterval;
            rhLinkUpdates.nextDueRH = (currentRH + rhInterval).toString();
          }
          const vId = workOrder.vesselId || job.vesselId;
          if (component.cuuid && vId) {
            await repo.updateJobComponentLinkTracking(vId, job.juuid, component.cuuid, rhLinkUpdates);
          }
          await repo.updateJob(job.juuid, rhUpdates);
          console.log(`✅ [Finalize] Updated RH job ${job.jobNo} lastDoneRH: ${currentRH}`);
        }
      }
    }
  } catch (err) {
    console.error('[Finalize] Failed to update job cycle dates:', err);
  }

  // ── 4. Spare consumption at approval (idempotent via prior-txn check) ────
  try {
    const consumedSpareParts = ensureArray(workOrder.consumedSpareParts) as Array<{
      partNo: string; partCode?: string; quantityConsumed: number | string;
      locationId?: number | null; location?: string; locationName?: string;
      comments?: string; _deductedQty?: number;
    }>;
    if (consumedSpareParts.length > 0) {
      const woVesselId = workOrder.vesselId || 'V001';
      const allSpares = await repo.findSpares(woVesselId);
      for (const cs of consumedSpareParts) {
        const qty = typeof cs.quantityConsumed === 'string' ? parseFloat(cs.quantityConsumed) : cs.quantityConsumed;
        const alreadyDeducted = cs._deductedQty || 0;

        let spare: any = cs.partCode ? allSpares.find((s: any) => s.partCode === cs.partCode) : null;
        if (!spare && cs.partNo) {
          spare = allSpares.find((s: any) => s.partCode === cs.partNo)
            || allSpares.find((s: any) => s.partNumber === cs.partNo)
            || null;
        }
        if (!spare) { console.warn(`[Finalize] Spare ${cs.partCode || cs.partNo} not found, skipping`); continue; }

        let locationId: number | null = cs.locationId ? parseInt(String(cs.locationId)) : null;
        const locName = cs.location || cs.locationName;
        if ((!locationId || isNaN(locationId)) && locName) {
          const locObj = await repo.findOrCreateLocation(woVesselId, locName, workOrder.approver || 'system');
          if (locObj) locationId = locObj.id;
        }
        if (!locationId || isNaN(locationId)) { console.warn(`[Finalize] No location for spare ${cs.partCode || cs.partNo}, skipping`); continue; }

        const existingTxns = await repo.getInventoryTransactions(woVesselId, { spareId: spare.id, locationId, eventType: 'CONSUME' });
        const priorTotal = existingTxns
          .filter((t: any) => t.referenceId === workOrder.wouuid)
          .reduce((s: number, t: any) => s + Math.abs(t.qtyChange || 0), 0);
        const effectiveRemaining = (qty || 0) - Math.max(alreadyDeducted, priorTotal);
        if (effectiveRemaining <= 0) {
          console.log(`⏭️ [Finalize] Spare ${cs.partCode || cs.partNo} already fully deducted, skipping`);
          continue;
        }

        try {
          await repo.performInventoryTransaction({
            vesselId: woVesselId,
            spareId: spare.id,
            locationId,
            eventType: 'CONSUME',
            qtyChange: -Math.abs(effectiveRemaining),
            referenceType: 'WORK_ORDER',
            referenceId: workOrder.wouuid,
            referenceNote: `WO L2 Approval: ${workOrder.workOrderNo}${cs.comments ? ' - ' + cs.comments : ''}`,
            userId: workOrder.approver || 'system',
          });
          console.log(`✅ [Finalize] Deducted ${effectiveRemaining} of spare ${spare.partCode} at location ${locationId}`);
        } catch (txnErr: any) {
          console.error(`[Finalize] Spare transaction failed for ${spare.partCode || cs.partNo}:`, txnErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Finalize] Failed to process spare consumption:', err);
  }
}
