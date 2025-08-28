// test-server.js - Simple test to verify server is working
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testServer() {
  console.log('🧪 Testing Thrive Teams API Server...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/`);
    console.log('Status:', healthResponse.status);
    const healthData = await healthResponse.text();
    console.log('Response:', healthData);
    console.log('');

    // Test 2: Check Availability
    console.log('2️⃣ Testing Availability Check...');
    const availabilityResponse = await fetch(`${BASE_URL}/api/check-availability?date=2025-01-15&time=10:00`);
    console.log('Status:', availabilityResponse.status);
    const availabilityData = await availabilityResponse.text();
    console.log('Response:', availabilityData);
    console.log('');

    // Test 3: Schedule Discovery Call
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

    console.log('Status:', discoveryResponse.status);
    const discoveryResult = await discoveryResponse.text();
    console.log('Response:', discoveryResult);
    console.log('');

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testServer();

