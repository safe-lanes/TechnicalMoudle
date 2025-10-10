const fs = require('fs');

// Read the test data
const data = JSON.parse(fs.readFileSync('test-data.json', 'utf8'));

// Function to generate a proper action taken text based on description
function generateActionTaken(description) {
  const actions = [
    "Replaced faulty component with new spare part from inventory",
    "Performed complete maintenance and calibration as per manufacturer specifications",
    "Applied temporary repair pending permanent solution during next dry dock",
    "Adjusted settings and parameters to restore normal operation",
    "Cleaned and overhauled the system, replaced worn seals and gaskets",
    "Repaired electrical connections and replaced damaged wiring",
    "Performed alignment check and corrected misalignment issues",
    "Replaced filters and performed system flush with approved chemicals",
    "Welded crack and performed NDT inspection to verify repair integrity",
    "Replaced bearing assembly and performed vibration analysis"
  ];
  
  // Use description hash to consistently pick an action
  let hash = 0;
  for (let i = 0; i < description.length; i++) {
    hash = ((hash << 5) - hash) + description.charCodeAt(i);
    hash = hash & hash;
  }
  return actions[Math.abs(hash) % actions.length];
}

// Function to format date as DD-MM-YYYY
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Update all closed defects
let updatedCount = 0;
for (const id in data.defects) {
  const defect = data.defects[id];
  
  if (defect.status === 'Closed') {
    // Add action taken if missing
    if (!defect.actionTakenRequested) {
      defect.actionTakenRequested = generateActionTaken(defect.description || 'General maintenance');
    }
    
    // Add target date if missing (set to issue date + 7 days)
    if (!defect.targetCloseDate) {
      const issueDate = new Date(defect.issueDate);
      const targetDate = new Date(issueDate);
      targetDate.setDate(targetDate.getDate() + 7);
      defect.targetCloseDate = formatDate(targetDate);
    }
    
    // Add completion date if missing
    if (!defect.dateCompleted) {
      // If we have closedOn, use that date, otherwise use target date
      if (defect.closedOn) {
        defect.dateCompleted = formatDate(defect.closedOn);
      } else {
        // Use target date or issue date + 5 days
        const issueDate = new Date(defect.issueDate);
        const completedDate = new Date(issueDate);
        completedDate.setDate(completedDate.getDate() + 5);
        defect.dateCompleted = formatDate(completedDate);
      }
    }
    
    // Ensure we have a closure comment
    if (!defect.closureComment) {
      defect.closureComment = "Work completed as per maintenance procedure. System tested and verified operational.";
    }
    
    updatedCount++;
  }
}

// Write the updated data back
fs.writeFileSync('test-data.json', JSON.stringify(data, null, 2));

console.log(`Updated ${updatedCount} closed defects with proper resolution details`);