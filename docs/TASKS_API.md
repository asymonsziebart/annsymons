# Tasks API Documentation

The External Tasks API provides authenticated REST endpoints for Ann's home server to synchronize tasks. All changes made through this API are immediately reflected on the website, and vice versa.

## Authentication

All API endpoints require Bearer token authentication. Include the API token in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY_HERE
```

### Setup

1. Generate a secure random API key (recommended: at least 32 characters)
2. Set the `EXTERNAL_TASKS_API_KEY` environment variable in your hosting (e.g., Vercel)
3. Use this key in all API requests from your home server

**Example generating a secure key:**
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional: Webhook Notifications

To receive push notifications when tasks change on the website (avoiding the need to poll):

1. Set up a webhook endpoint on your home server that accepts POST requests
2. Set the `TASKS_WEBHOOK_URL` environment variable to your webhook URL
3. Your endpoint will receive JSON notifications for all task changes

**Webhook payload format:**
```json
{
  "event": "task.created" | "task.updated" | "task.deleted",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "id": 123,
    "title": "Task title",
    ...
  }
}
```

## Base URL

- **Production**: `https://annsymons.com`
- **Local development**: `http://localhost:3333`

All endpoints are prefixed with `/api/v1`

## Endpoints

### List All Tasks

Get all tasks and their sections.

**Request:**
```http
GET /api/v1/tasks
Authorization: Bearer YOUR_API_KEY_HERE
```

**Query Parameters:**
- `updated_since` (optional): ISO 8601 timestamp - returns only tasks created after this time

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Task title",
      "description": "Task description",
      "due_date": "2024-12-31",
      "status": "todo",
      "section_id": 1,
      "section_name": "Section Name",
      "assignee": "Ann",
      "priority": "high",
      "estimated_minutes": 60,
      "actual_minutes": null,
      "dependencies": null,
      "depends_on_task_ids": [],
      "recurrence_interval": null,
      "recurrence_month": null,
      "requester": null,
      "quarter": null,
      "project_label": null,
      "sort_order": 0,
      "created_at": "2024-01-01T12:00:00.000Z",
      "last_overdue_email_at": null,
      "subtask_count": 0
    }
  ],
  "sections": [
    {
      "id": 1,
      "name": "High Priority",
      "color_key": "red",
      "sort_order": 0,
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**curl example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  https://annsymons.com/api/v1/tasks
```

---

### Get Single Task

Get a specific task by ID.

**Request:**
```http
GET /api/v1/tasks/:id
Authorization: Bearer YOUR_API_KEY_HERE
```

**Response:**
```json
{
  "task": {
    "id": 1,
    "title": "Task title",
    ...
  }
}
```

**curl example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  https://annsymons.com/api/v1/tasks/123
```

---

### Create Task

Create a new task.

**Request:**
```http
POST /api/v1/tasks
Authorization: Bearer YOUR_API_KEY_HERE
Content-Type: application/json

{
  "title": "New task",
  "section_id": 1,
  "description": "Task description",
  "status": "todo",
  "priority": "medium"
}
```

**Required fields:**
- `title` (string): Task title
- `section_id` (number): Section ID (get from list endpoint)

**Optional fields:**
- `description` (string | null): Task description
- `due_date` (string | null): Due date in YYYY-MM-DD format
- `status` (string): One of: `todo`, `in_progress`, `blocked`, `done`, `cancelled` (default: `todo`)
- `assignee` (string | null): Person assigned to the task
- `priority` (string): One of: `none`, `high`, `medium`, `low` (default: auto-detected from section)
- `estimated_minutes` (number | null): Estimated time in minutes
- `actual_minutes` (number | null): Actual time spent in minutes
- `dependencies` (string | null): Free-text dependencies description
- `depends_on_task_ids` (number[]): Array of task IDs that must be completed first
- `recurrence_interval` (string | null): One of: `daily`, `weekly`, `monthly`, `yearly`
- `recurrence_month` (number | null): For yearly recurrence, month 1-12
- `requester` (string | null): Person who requested the task
- `quarter` (string | null): Quarter label (e.g., "Q1 2024")
- `project_label` (string | null): Project label

**Response:** (HTTP 201)
```json
{
  "task": {
    "id": 123,
    "title": "New task",
    ...
  }
}
```

**curl example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy groceries",
    "section_id": 1,
    "description": "Milk, eggs, bread",
    "due_date": "2024-12-31",
    "status": "todo",
    "priority": "medium",
    "assignee": "Ann"
  }' \
  https://annsymons.com/api/v1/tasks
```

---

### Update Task

Update an existing task. Only include fields you want to change.

**Request:**
```http
PATCH /api/v1/tasks/:id
Authorization: Bearer YOUR_API_KEY_HERE
Content-Type: application/json

{
  "title": "Updated title",
  "status": "done"
}
```

**Updatable fields:** Same as create, all optional

**Response:**
```json
{
  "task": {
    "id": 123,
    "title": "Updated title",
    "status": "done",
    ...
  }
}
```

**curl example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "actual_minutes": 30
  }' \
  https://annsymons.com/api/v1/tasks/123
```

---

### Delete Task

Delete a task.

**Request:**
```http
DELETE /api/v1/tasks/:id
Authorization: Bearer YOUR_API_KEY_HERE
```

**Response:**
```json
{
  "ok": true
}
```

**curl example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  https://annsymons.com/api/v1/tasks/123
```

---

## Status Codes

- `200 OK` - Request successful (GET, PATCH)
- `201 Created` - Task created successfully (POST)
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid API key
- `404 Not Found` - Task not found
- `409 Conflict` - Task completion blocked by dependencies
- `500 Internal Server Error` - Server error

## Error Response Format

```json
{
  "error": "Error message here"
}
```

For dependency conflicts:
```json
{
  "error": "Cannot complete task because it depends on incomplete tasks",
  "blocking_task_ids": [1, 2, 3]
}
```

## Syncing Strategy

### For the Home Server

1. **Initial sync**: Call `GET /api/v1/tasks` to get all tasks and sections
2. **Periodic sync**: Call `GET /api/v1/tasks?updated_since=<last_sync_time>` every few minutes
3. **Push changes**: Use POST/PATCH/DELETE to update tasks from home server

### With Webhooks (Optional)

If you configure `TASKS_WEBHOOK_URL`:

1. Website changes instantly push to your home server
2. Your home server can still poll as a backup
3. Home server changes are immediately visible on the website

## Task Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique task ID |
| `title` | string | Task title |
| `description` | string \| null | Task description |
| `due_date` | string \| null | Due date (YYYY-MM-DD) |
| `status` | string | `todo`, `in_progress`, `blocked`, `done`, `cancelled` |
| `section_id` | number | Section this task belongs to |
| `section_name` | string | Section name (read-only) |
| `assignee` | string \| null | Person assigned |
| `priority` | string | `none`, `high`, `medium`, `low` |
| `estimated_minutes` | number \| null | Estimated time |
| `actual_minutes` | number \| null | Actual time spent |
| `dependencies` | string \| null | Free-text dependencies |
| `depends_on_task_ids` | number[] | Task IDs that must be done first |
| `recurrence_interval` | string \| null | `daily`, `weekly`, `monthly`, `yearly` |
| `recurrence_month` | number \| null | Month 1-12 for yearly recurrence |
| `requester` | string \| null | Who requested the task |
| `quarter` | string \| null | Quarter label |
| `project_label` | string \| null | Project label |
| `sort_order` | number | Order within section |
| `created_at` | string | Creation timestamp (ISO 8601) |
| `last_overdue_email_at` | string \| null | Last overdue notification |
| `subtask_count` | number | Number of subtasks |

## Required Environment Variables

Set these in your hosting environment (e.g., Vercel Dashboard → Settings → Environment Variables):

1. **`EXTERNAL_TASKS_API_KEY`** (required)
   - Your secret API key for authenticating external requests
   - Generate using: `openssl rand -hex 32`
   - Keep this secret! Anyone with this key can read/modify all tasks

2. **`TASKS_WEBHOOK_URL`** (optional)
   - URL of your home server's webhook endpoint
   - Will receive POST notifications when tasks change on the website
   - Example: `https://your-home-server.example.com/webhooks/tasks`

3. **`DATABASE_URL`** (already configured)
   - Your Neon Postgres connection string

## Testing

A verification script is included to test the API:

```bash
# Install dependencies if needed
npm install

# Run the dev server
npm run dev

# In another terminal, run the verification script
node scripts/verify-tasks-api.js http://localhost:3333 YOUR_API_KEY_HERE
```

The script will:
- Test authentication
- List tasks
- Create a test task
- Update the task
- Delete the task
- Verify all operations

## Security Notes

1. **API Key Security**
   - Never commit the API key to version control
   - Use a strong, randomly generated key (32+ characters)
   - Rotate the key periodically
   - Store it securely on your home server

2. **HTTPS**
   - Always use HTTPS in production (automatic on Vercel)
   - Never send the API key over unencrypted HTTP

3. **Rate Limiting**
   - Consider adding rate limiting if needed (not currently implemented)
   - Reasonable polling: once per minute or less

## Troubleshooting

### 401 Unauthorized
- Check that `EXTERNAL_TASKS_API_KEY` is set in your hosting environment
- Verify the Authorization header format: `Bearer YOUR_KEY`
- Ensure the key matches exactly (no extra spaces or newlines)

### 404 Not Found on POST
- Verify the section_id exists (call GET /api/v1/tasks to see available sections)
- Check that you're using `/api/v1/tasks` (not `/api/tasks`)

### Tasks not syncing
- Check webhook URL is correct and accessible
- Verify your home server accepts POST requests
- Check server logs for webhook errors (errors are logged but don't block API responses)

## Example Integration (Python)

```python
import requests
from datetime import datetime

class TasksAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def list_tasks(self, updated_since=None):
        url = f'{self.base_url}/api/v1/tasks'
        params = {}
        if updated_since:
            params['updated_since'] = updated_since
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def create_task(self, title, section_id, **kwargs):
        url = f'{self.base_url}/api/v1/tasks'
        data = {'title': title, 'section_id': section_id, **kwargs}
        
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()['task']
    
    def update_task(self, task_id, **kwargs):
        url = f'{self.base_url}/api/v1/tasks/{task_id}'
        
        response = requests.patch(url, headers=self.headers, json=kwargs)
        response.raise_for_status()
        return response.json()['task']
    
    def delete_task(self, task_id):
        url = f'{self.base_url}/api/v1/tasks/{task_id}'
        
        response = requests.delete(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
api = TasksAPI('https://annsymons.com', 'your-api-key-here')

# Get all tasks
result = api.list_tasks()
tasks = result['tasks']
sections = result['sections']

# Create a task
task = api.create_task(
    title='New task from home server',
    section_id=sections[0]['id'],
    description='Created via API',
    status='todo',
    priority='high'
)

# Update a task
updated = api.update_task(task['id'], status='done')

# Delete a task
api.delete_task(task['id'])
```
