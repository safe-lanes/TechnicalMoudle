const axios = require('axios');

async function testCreateClosed() {
  try {
    const response = await axios.post('http://localhost:5000/api/defects', {
      vesselId: 'V001',
      vesselName: 'MV SEAFARER', 
      issueDate: '15-10-2025',
      targetCloseDate: '30-10-2025',
      status: 'Closed',
      description: 'Test closed defect',
      category: 'Defect',
      reportedBy: 'Test User'
    });
    console.log('Created closed defect:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCreateClosed();
