// test-api.js - Simple test script for the Teams API
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testAPI() {
  console.log('🧪 Testing Thrive Teams API...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check Response:', healthData);
    console.log('');

    // Test 2: Check Availability
    console.log('2️⃣ Testing Availability Check...');
    const availabilityResponse = await fetch(`${BASE_URL}/api/check-availability?date=2025-01-15&time=10:00`);
    const availabilityData = await availabilityResponse.json();
    console.log('✅ Availability Response:', availabilityData);
    console.log('');

    // Test 3: Schedule Discovery Call (Mock - will fail without Azure credentials)
    console.log('3️⃣ Testing Discovery Call Scheduling...');
    const discoveryCallData = {
      selectedDate: "2025-01-15",
      selectedTime: "10:00",
      userDetails: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        companyName: "Test Company",
        revenue: "500,000 - 1M"
      },
      organizerEmail: "anna@thrive.com"
    };

    const discoveryResponse = await fetch(`${BASE_URL}/api/schedule-discovery-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discoveryCallData)
    });

    const discoveryResult = await discoveryResponse.json();
    console.log('✅ Discovery Call Response:', discoveryResult);
    console.log('');

    console.log('🎉 All tests completed!');
    console.log('📝 Note: Discovery call test will fail without proper Azure credentials in .env file');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAPI();

