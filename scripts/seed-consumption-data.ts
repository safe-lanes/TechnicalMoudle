import { db } from "../server/db";
import { storesLedger, storesItems } from "../shared/schema";
import { eq } from "drizzle-orm";

const VESSEL_ID = "7440571a-841a-11ed-aa7c-7003bca91a86";

const PORTS = [
  "Singapore", "Rotterdam", "Fujairah", "Busan", "Shanghai",
  "Jebel Ali", "Mumbai", "Colombo", "Durban", "Las Palmas",
];

const CONSUME_REMARKS = [
  "Routine maintenance consumption",
  "Engine room maintenance",
  "Deck maintenance work",
  "Safety equipment replenishment",
  "Scheduled overhaul requirement",
  "Emergency repair usage",
  "Regular operational consumption",
  "Monthly routine usage",
  "Quarterly maintenance requirement",
  "Voyage preparation consumption",
  "Port state inspection preparation",
  "Hull maintenance work",
  "Machinery space maintenance",
  "Accommodation maintenance",
  "Navigation equipment maintenance",
];

const RECEIVE_REMARKS = [
  "Supply received per PO",
  "Requisition fulfilled",
  "Port supply delivery",
  "Emergency supply received",
  "Quarterly supply order",
  "Annual stock replenishment",
  "Supplier delivery on schedule",
  "Top-up supply received",
];

const WO_REFS = [
  "WO-2025-001", "WO-2025-002", "WO-2025-003", "WO-2025-004",
  "WO-2025-005", "WO-2025-006", "WO-2025-007", "WO-2025-008",
  "WO-2025-009", "WO-2025-010", "WO-2025-011", "WO-2025-012",
];

const PO_REFS = [
  "PO-2025-101", "PO-2025-102", "PO-2025-103", "PO-2025-104",
  "PO-2025-105", "PO-2025-106", "PO-2025-107", "PO-2025-108",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDateLocal(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mmm}-${yyyy} ${hh}:${mm}`;
}

function sectionFromType(itemType: string): string {
  const map: Record<string, string> = {
    "lubricants": "lubes",
    "lubes": "lubes",
    "stores": "stores",
    "chemicals": "chemicals",
    "others": "others",
  };
  return map[itemType] || itemType;
}

interface ItemInfo {
  id: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  uom: string | null;
  rob: string;
  min: string;
}

async function seed() {
  console.log("Fetching existing stores items for vessel...");
  const items = await db
    .select({
      id: storesItems.id,
      itemCode: storesItems.itemCode,
      itemName: storesItems.itemName,
      itemType: storesItems.itemType,
      uom: storesItems.uom,
      rob: storesItems.rob,
      min: storesItems.min,
    })
    .from(storesItems)
    .where(eq(storesItems.vesselId, VESSEL_ID));

  console.log(`Found ${items.length} items`);
  if (items.length === 0) {
    console.log("No items found. Exiting.");
    return;
  }

  const records: any[] = [];
  const robTracker: Record<number, number> = {};

  for (const item of items) {
    robTracker[item.id] = 50;
  }

  const startDate = new Date("2025-02-01T00:00:00Z");
  const endDate = new Date("2026-01-31T23:59:59Z");

  const highConsumptionItems = items.filter(i =>
    ["stores", "chemicals"].includes(i.itemType)
  );
  const medConsumptionItems = items.filter(i => i.itemType === "lubes");
  const lowConsumptionItems = items.filter(i => i.itemType === "others");

  for (let month = 0; month < 12; month++) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + month);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    for (const item of highConsumptionItems) {
      const consumeEvents = randomInt(2, 4);
      for (let e = 0; e < consumeEvents; e++) {
        const day = randomInt(1, daysInMonth);
        const hour = randomInt(6, 22);
        const minute = randomInt(0, 59);
        const eventDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour, minute);

        if (eventDate > endDate) continue;

        const qty = item.uom === "ltr" ? randomInt(2, 8) : randomInt(1, 5);
        robTracker[item.id] = Math.max(0, robTracker[item.id] - qty);

        records.push({
          vesselId: VESSEL_ID,
          section: sectionFromType(item.itemType),
          itemId: item.id,
          partCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          eventType: "CONSUME",
          qtyChangeBase: (-qty).toFixed(2),
          qtyDisplay: (-qty).toFixed(2),
          uomDisplay: item.uom,
          robAfterBase: robTracker[item.id].toFixed(2),
          dateLocal: formatDateLocal(eventDate),
          tz: "UTC",
          timestampUTC: eventDate,
          place: null,
          ref: randomElement(WO_REFS),
          userId: "1",
          remarks: randomElement(CONSUME_REMARKS),
        });
      }

      if (month % 3 === 2 || robTracker[item.id] < 10) {
        const receiveDay = randomInt(20, daysInMonth);
        const receiveDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), receiveDay, randomInt(8, 16), randomInt(0, 59));
        if (receiveDate <= endDate) {
          const receiveQty = randomInt(10, 25);
          robTracker[item.id] += receiveQty;

          records.push({
            vesselId: VESSEL_ID,
            section: sectionFromType(item.itemType),
            itemId: item.id,
            partCode: item.itemCode,
            itemName: item.itemName,
            uom: item.uom,
            eventType: "RECEIVE",
            qtyChangeBase: receiveQty.toFixed(2),
            qtyDisplay: receiveQty.toFixed(2),
            uomDisplay: item.uom,
            robAfterBase: robTracker[item.id].toFixed(2),
            dateLocal: formatDateLocal(receiveDate),
            tz: "UTC",
            timestampUTC: receiveDate,
            place: randomElement(PORTS),
            ref: randomElement(PO_REFS),
            userId: "1",
            remarks: randomElement(RECEIVE_REMARKS),
          });
        }
      }
    }

    for (const item of medConsumptionItems) {
      const consumeEvents = randomInt(1, 3);
      for (let e = 0; e < consumeEvents; e++) {
        const day = randomInt(1, daysInMonth);
        const hour = randomInt(6, 22);
        const minute = randomInt(0, 59);
        const eventDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour, minute);
        if (eventDate > endDate) continue;

        const qty = randomInt(3, 12);
        robTracker[item.id] = Math.max(0, robTracker[item.id] - qty);

        records.push({
          vesselId: VESSEL_ID,
          section: sectionFromType(item.itemType),
          itemId: item.id,
          partCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          eventType: "CONSUME",
          qtyChangeBase: (-qty).toFixed(2),
          qtyDisplay: (-qty).toFixed(2),
          uomDisplay: item.uom,
          robAfterBase: robTracker[item.id].toFixed(2),
          dateLocal: formatDateLocal(eventDate),
          tz: "UTC",
          timestampUTC: eventDate,
          place: null,
          ref: randomElement(WO_REFS),
          userId: "1",
          remarks: randomElement(CONSUME_REMARKS),
        });
      }

      if (month % 2 === 1 || robTracker[item.id] < 15) {
        const receiveDay = randomInt(15, daysInMonth);
        const receiveDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), receiveDay, randomInt(8, 16), randomInt(0, 59));
        if (receiveDate <= endDate) {
          const receiveQty = randomInt(15, 40);
          robTracker[item.id] += receiveQty;

          records.push({
            vesselId: VESSEL_ID,
            section: sectionFromType(item.itemType),
            itemId: item.id,
            partCode: item.itemCode,
            itemName: item.itemName,
            uom: item.uom,
            eventType: "RECEIVE",
            qtyChangeBase: receiveQty.toFixed(2),
            qtyDisplay: receiveQty.toFixed(2),
            uomDisplay: item.uom,
            robAfterBase: robTracker[item.id].toFixed(2),
            dateLocal: formatDateLocal(receiveDate),
            tz: "UTC",
            timestampUTC: receiveDate,
            place: randomElement(PORTS),
            ref: randomElement(PO_REFS),
            userId: "1",
            remarks: randomElement(RECEIVE_REMARKS),
          });
        }
      }
    }

    for (const item of lowConsumptionItems) {
      if (randomInt(1, 100) <= 60) {
        const day = randomInt(1, daysInMonth);
        const eventDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, randomInt(8, 18), randomInt(0, 59));
        if (eventDate > endDate) continue;

        const qty = randomInt(1, 4);
        robTracker[item.id] = Math.max(0, robTracker[item.id] - qty);

        records.push({
          vesselId: VESSEL_ID,
          section: sectionFromType(item.itemType),
          itemId: item.id,
          partCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          eventType: "CONSUME",
          qtyChangeBase: (-qty).toFixed(2),
          qtyDisplay: (-qty).toFixed(2),
          uomDisplay: item.uom,
          robAfterBase: robTracker[item.id].toFixed(2),
          dateLocal: formatDateLocal(eventDate),
          tz: "UTC",
          timestampUTC: eventDate,
          place: null,
          ref: randomElement(WO_REFS),
          userId: "1",
          remarks: randomElement(CONSUME_REMARKS),
        });
      }

      if (month % 4 === 3 || robTracker[item.id] < 5) {
        const receiveDay = randomInt(20, daysInMonth);
        const receiveDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), receiveDay, randomInt(8, 16), randomInt(0, 59));
        if (receiveDate <= endDate) {
          const receiveQty = randomInt(5, 15);
          robTracker[item.id] += receiveQty;

          records.push({
            vesselId: VESSEL_ID,
            section: sectionFromType(item.itemType),
            itemId: item.id,
            partCode: item.itemCode,
            itemName: item.itemName,
            uom: item.uom,
            eventType: "RECEIVE",
            qtyChangeBase: receiveQty.toFixed(2),
            qtyDisplay: receiveQty.toFixed(2),
            uomDisplay: item.uom,
            robAfterBase: robTracker[item.id].toFixed(2),
            dateLocal: formatDateLocal(receiveDate),
            tz: "UTC",
            timestampUTC: receiveDate,
            place: randomElement(PORTS),
            ref: randomElement(PO_REFS),
            userId: "1",
            remarks: randomElement(RECEIVE_REMARKS),
          });
        }
      }
    }
  }

  records.sort((a, b) => a.timestampUTC.getTime() - b.timestampUTC.getTime());

  console.log(`Inserting ${records.length} ledger records...`);

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(storesLedger).values(batch);
    console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
  }

  const consumeCount = records.filter(r => r.eventType === "CONSUME").length;
  const receiveCount = records.filter(r => r.eventType === "RECEIVE").length;
  console.log(`\nDone! Inserted ${records.length} records total:`);
  console.log(`  CONSUME events: ${consumeCount}`);
  console.log(`  RECEIVE events: ${receiveCount}`);
  console.log(`  Date range: ${formatDateLocal(records[0].timestampUTC)} to ${formatDateLocal(records[records.length - 1].timestampUTC)}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
