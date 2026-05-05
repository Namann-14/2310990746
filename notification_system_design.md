# Stage 1

## REST API design

Assumptions:
- Auth via Bearer token.
- Notifications are per-student, but some are global (broadcast) and fanned out to per-student read state.

### Endpoints

| Action | Method | Endpoint | Notes |
| --- | --- | --- | --- |
| Fetch notifications | GET | /v1/notifications | Filters, pagination, unread-only |
| Mark as read | PATCH | /v1/notifications/{id}/read | Idempotent |
| Create notification | POST | /v1/notifications | Admin/system only |
| Real-time stream | GET | /v1/notifications/stream | SSE |

### Headers

```
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: <uuid>  // for POST
```

### Fetch notifications

```
GET /v1/notifications?type=Placement&unread=true&limit=20&cursor=eyJpZCI6MTIzfQ==
```

Response:

```json
{
  "data": [
    {
      "id": 9876,
      "studentId": 1042,
      "type": "Placement",
      "title": "Interview scheduled",
      "body": "Google round 2 on May 7",
      "createdAt": "2026-05-05T09:10:00Z",
      "readAt": null
    }
  ],
  "page": {
    "limit": 20,
    "nextCursor": "eyJpZCI6OTg3Nn0=",
    "hasMore": true
  }
}
```

### Mark as read

```
PATCH /v1/notifications/9876/read
```

Response:

```json
{
  "id": 9876,
  "readAt": "2026-05-05T10:01:00Z"
}
```

### Create notification

```
POST /v1/notifications
```

Request:

```json
{
  "audience": "students",
  "targetStudentIds": [1042, 1050],
  "type": "Event",
  "title": "Tech Talk",
  "body": "Auditorium B at 4 PM",
  "priority": "normal"
}
```

Response:

```json
{
  "notificationId": 10022,
  "fanoutStatus": "queued"
}
```

### Filtering + pagination

Supported filters:

| Filter | Example | Notes |
| --- | --- | --- |
| type | type=Placement | enum Placement, Result, Event |
| unread | unread=true | unread only |
| since | since=2026-05-01T00:00:00Z | lower bound |
| limit | limit=20 | max 100 |
| cursor | cursor=... | opaque cursor for keyset pagination |

### Real-time mechanism

Use SSE for one-way delivery.

```
GET /v1/notifications/stream
Accept: text/event-stream
```

Event payload:

```json
{
  "id": 10022,
  "type": "Placement",
  "title": "Offer released",
  "body": "Please check portal",
  "createdAt": "2026-05-05T10:05:00Z"
}
```

Rationale: SSE is simpler than WebSockets for a server-to-client stream, plays well with HTTP infrastructure, and supports automatic reconnects. If we need bidirectional interactions later, we can add WebSockets without breaking clients.

# Stage 2

## Database design

**DB choice: PostgreSQL**
- Strong consistency for read/unread tracking.
- Composite + partial indexes are critical for unread queries.
- Supports partitioning and JSONB for flexible notification metadata.

### Core schema

```sql
CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- Placement | Result | Event
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_reads (
    student_id BIGINT NOT NULL REFERENCES students(id),
    notification_id BIGINT NOT NULL REFERENCES notifications(id),
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, notification_id)
);
```

### Indexes

```sql
-- Fast unread lookup by student
CREATE INDEX idx_notification_reads_unread
ON notification_reads (student_id, created_at DESC)
WHERE read_at IS NULL;

-- Fetch notifications by type and time
CREATE INDEX idx_notifications_type_created
ON notifications (type, created_at DESC);

-- Join acceleration
CREATE INDEX idx_notification_reads_notification
ON notification_reads (notification_id);
```

### Scaling concerns and mitigation

| Problem | Why it hurts | Mitigation |
| --- | --- | --- |
| Huge `notification_reads` | Explodes per-student rows | Partition by student_id hash or by time; archive old read rows |
| Unread queries slow | Needs read_at filter + order | Partial index on unread rows |
| High fanout cost | Broadcast to all students | Queue-driven fanout + batch inserts |
| Hot feed queries | Same recent items | Redis cache for recent pages |

### SQL for Stage 1 APIs

Fetch notifications (keyset pagination):

```sql
SELECT n.id, n.type, n.title, n.body, n.created_at, nr.read_at
FROM notification_reads nr
JOIN notifications n ON n.id = nr.notification_id
WHERE nr.student_id = $1
  AND ($2::text IS NULL OR n.type = $2)
  AND ($3::timestamptz IS NULL OR n.created_at >= $3)
  AND ($4::boolean IS NULL OR ($4 = true AND nr.read_at IS NULL))
  AND ($5::bigint IS NULL OR n.id < $5)
ORDER BY n.id DESC
LIMIT $6;
```

Mark as read:

```sql
UPDATE notification_reads
SET read_at = now()
WHERE student_id = $1 AND notification_id = $2 AND read_at IS NULL
RETURNING notification_id, read_at;
```

Create notification:

```sql
INSERT INTO notifications (type, title, body, metadata)
VALUES ($1, $2, $3, $4)
RETURNING id;
```

Fanout rows (batch):

```sql
INSERT INTO notification_reads (student_id, notification_id)
SELECT id, $1 FROM students WHERE id = ANY($2::bigint[]);
```

# Stage 3

## Query optimization

Given query:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### Is it correct?
- Not in the current schema. Read state is in `notification_reads`, not in `notifications`.

### Why is it slow?
- Full scan + sort if there is no composite index.
- `SELECT *` pulls unnecessary columns, increasing IO.

### Fixed query + indexes

```sql
SELECT n.id, n.type, n.title, n.body, n.created_at
FROM notification_reads nr
JOIN notifications n ON n.id = nr.notification_id
WHERE nr.student_id = 1042 AND nr.read_at IS NULL
ORDER BY n.created_at DESC
LIMIT 50;
```

Indexes:

```sql
CREATE INDEX idx_nr_student_unread_created
ON notification_reads (student_id, created_at DESC)
WHERE read_at IS NULL;
```

### Complexity improvement
- Before: $O(N)$ scan + $O(M \log M)$ sort.
- After: $O(\log N)$ index seek + $O(K)$ for top K results.

### Why not index every column?
- Every extra index slows writes and inflates storage.
- Many indexes are unused but still maintained.
- It can confuse the planner and lead to suboptimal plans.

### Students who received Placement notifications in last 7 days

```sql
SELECT DISTINCT s.id, s.name
FROM students s
JOIN notification_reads nr ON nr.student_id = s.id
JOIN notifications n ON n.id = nr.notification_id
WHERE n.type = 'Placement'
  AND n.created_at >= now() - interval '7 days';
```

# Stage 4

## Performance optimization

Problem: DB overload from fetching notifications on every page load.

### Solutions and trade-offs

| Solution | Benefit | Trade-off |
| --- | --- | --- |
| Redis cache | Offloads frequent reads, fast | Staleness, invalidation complexity |
| Pagination (keyset) | Small result sets, stable | Cannot jump to arbitrary page number |
| SSE/WebSockets | Push instead of pull | Persistent connections, infra tuning |
| Read replicas | Offload read traffic | Replica lag, operational cost |

Practical approach: cache last 50 notifications per student in Redis, keyset pagination for history, and SSE for new items. This removes the "poll on every load" behavior while keeping UX snappy.

# Stage 5

## Scalability and reliability

### Problems with naive sequential processing
- HTTP request blocks while sending thousands of emails.
- One failure stops the loop; partial delivery is common.
- No retry or idempotency guarantees.

### Improved design
- Write notification to DB.
- Enqueue fanout task to message queue.
- Worker batches fanout and email delivery.
- Retry with exponential backoff; DLQ for poison messages.
- Idempotency key per notification to avoid duplicates.

### What if email fails for 200 users?
- Those 200 jobs are retried independently.
- Unaffected users still receive the notification.
- After max retries, jobs go to DLQ for manual re-drive.

### Should DB + email happen together?
- No. DB write must succeed first. Email delivery is async and eventually consistent.
- Use outbox pattern to avoid missing events between DB write and queue publish.

### Pseudocode

```python
def create_notification(payload, idempotency_key):
    if db.outbox_exists(idempotency_key):
        return "duplicate"

    with db.transaction():
        notif_id = db.insert_notification(payload)
        db.insert_outbox({
            "idempotency_key": idempotency_key,
            "notification_id": notif_id
        })

def outbox_publisher():
    for event in db.fetch_unpublished_outbox(limit=100):
        queue.publish("fanout", event)
        db.mark_outbox_published(event.id)

def fanout_worker():
    for event in queue.consume("fanout"):
        students = db.get_target_students(event.notification_id)
        db.batch_insert_reads(students, event.notification_id)
        for student in students:
            queue.publish("email", {
                "notification_id": event.notification_id,
                "student_id": student.id
            })

def email_worker():
    for job in queue.consume("email"):
        email.send(job.student_id, job.notification_id)
```

# Stage 6

## Priority notifications logic (JavaScript)

Priority order: Placement > Result > Event. Recency breaks ties.

### Implementation

```javascript
const PRIORITY_SCORE = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function compareNotif(a, b) {
  const pa = PRIORITY_SCORE[a.type] || 0;
  const pb = PRIORITY_SCORE[b.type] || 0;
  if (pa !== pb) return pb - pa;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

async function fetchTop10Priority() {
  const res = await fetch(
    "http://20.207.122.201/evaluation-service/notifications"
  );
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const data = await res.json();

  const items = Array.isArray(data) ? data : data.data;
  if (!Array.isArray(items)) return [];

  // Sort once for simplicity; O(N log N) is acceptable for moderate N.
  return items.sort(compareNotif).slice(0, 10);
}

module.exports = { fetchTop10Priority };
```

### Maintain top-N efficiently as new data arrives

Use a min-heap of size K=10 with the inverse comparator. For each new notification:
- If heap size < K, push.
- Else compare with root; if higher priority, pop + push.
- This keeps updates at $O(\log K)$.

If the stream is high-volume, this avoids re-sorting the full list on every update.