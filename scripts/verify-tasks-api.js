#!/usr/bin/env node
/**
 * Verification script for the External Tasks API
 * 
 * Usage:
 *   node scripts/verify-tasks-api.js <base-url> <api-key>
 * 
 * Example:
 *   node scripts/verify-tasks-api.js http://localhost:3333 your-secret-api-key
 */

const BASE_URL = process.argv[2] || 'http://localhost:3333';
const API_KEY = process.argv[3];

if (!API_KEY) {
  console.error('Error: API key is required');
  console.error('Usage: node scripts/verify-tasks-api.js <base-url> <api-key>');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

let createdTaskId = null;
let testSectionId = null;

async function test(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${error.message}`);
    return false;
  }
}

async function fetchApi(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || text}`);
  }
  
  return data;
}

async function runTests() {
  console.log('External Tasks API Verification\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY.slice(0, 4)}...${API_KEY.slice(-4)}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Unauthorized access
  if (await test('Test unauthorized access', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/tasks`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  })) passed++; else failed++;

  // Test 2: List tasks and get section ID
  if (await test('List tasks (GET /api/v1/tasks)', async () => {
    const data = await fetchApi('/api/v1/tasks');
    if (!Array.isArray(data.tasks)) {
      throw new Error('tasks should be an array');
    }
    if (!Array.isArray(data.sections)) {
      throw new Error('sections should be an array');
    }
    if (!data.timestamp) {
      throw new Error('timestamp should be present');
    }
    // Get first section ID for creating tasks
    if (data.sections.length > 0) {
      testSectionId = data.sections[0].id;
      console.log(`    Found section ID: ${testSectionId}`);
    } else {
      throw new Error('No sections found. Please create at least one section in the database.');
    }
  })) passed++; else failed++;

  // Test 3: Create task
  if (testSectionId && await test('Create task (POST /api/v1/tasks)', async () => {
    const data = await fetchApi('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Task from API',
        section_id: testSectionId,
        description: 'This is a test task created by the verification script',
        status: 'todo',
        priority: 'medium',
      }),
    });
    if (!data.task || !data.task.id) {
      throw new Error('Created task should have an id');
    }
    createdTaskId = data.task.id;
    console.log(`    Created task ID: ${createdTaskId}`);
    if (data.task.title !== 'Test Task from API') {
      throw new Error('Task title mismatch');
    }
  })) passed++; else failed++;

  // Test 4: Get single task
  if (createdTaskId && await test('Get task (GET /api/v1/tasks/:id)', async () => {
    const data = await fetchApi(`/api/v1/tasks/${createdTaskId}`);
    if (!data.task || data.task.id !== createdTaskId) {
      throw new Error('Task ID mismatch');
    }
  })) passed++; else failed++;

  // Test 5: Update task
  if (createdTaskId && await test('Update task (PATCH /api/v1/tasks/:id)', async () => {
    const data = await fetchApi(`/api/v1/tasks/${createdTaskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Updated Test Task',
        status: 'in_progress',
        description: 'Updated description',
      }),
    });
    if (data.task.title !== 'Updated Test Task') {
      throw new Error('Task title not updated');
    }
    if (data.task.status !== 'in_progress') {
      throw new Error('Task status not updated');
    }
  })) passed++; else failed++;

  // Test 6: Delete task
  if (createdTaskId && await test('Delete task (DELETE /api/v1/tasks/:id)', async () => {
    const data = await fetchApi(`/api/v1/tasks/${createdTaskId}`, {
      method: 'DELETE',
    });
    if (!data.ok) {
      throw new Error('Delete should return { ok: true }');
    }
  })) passed++; else failed++;

  // Test 7: Verify deletion
  if (createdTaskId && await test('Verify task deleted', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/tasks/${createdTaskId}`, {
      headers,
    });
    if (response.status !== 404) {
      throw new Error(`Expected 404 for deleted task, got ${response.status}`);
    }
  })) passed++; else failed++;

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
