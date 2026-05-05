# Campus Notification System Design

## Stage 1: API & Real-time Design

### REST API Endpoints
**1. GET /notifications**
*   **Request**: `GET /notifications?page=1&limit=10&notification_type=Placement`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**:
    ```json
    {
      "total": 1500,
      "page": 1,
      "limit": 10,
      "data": [
        {
          "id": "1",
          "type": "Placement",
          "content": "Google Interview Scheduled",
          "timestamp": "2023-10-25T10:00:00Z"
        }
      ]
    }
    ```

**2. GET /notifications/priority**
*   **Request**: `GET /notifications/priority`
*   **Headers**: `Authorization: Bearer <token>`
*   **Response**:
    ```json
    {
      "data": [
        {
          "id": "2",
          "type": "Placement",
          "content": "Amazon final round",
          "timestamp": "2023-10-26T12:00:00Z"
        }
      ]
    }
    ```

### Real-Time Mechanism Design
**Choice: Server-Sent Events (SSE)**
*   **Justification**: Notifications are inherently a one-way communication stream (Server -> Client). SSE is built specifically for this and operates natively over standard HTTP without the overhead of the two-way duplexing required by WebSockets. It also handles automatic reconnections and is much simpler to implement and proxy through standard load balancers. WebSockets would be overkill since the client doesn't need to send high-frequency events back to the server (read receipts can just be standard REST calls).

---

## Stage 2: Database Design & Scaling

**Database Choice: PostgreSQL**
*   **Justification**: PostgreSQL is an advanced relational database that guarantees strict ACID compliance, which is critical for read/unread state accuracy. It also supports advanced indexing (like composite and partial indices) and JSONB formats if schemas for different notification types diverge. 

### Schema
```sql
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'Placement', 'Result', 'Event'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_reads (
    student_id INT REFERENCES students(student_id),
    notification_id INT REFERENCES notifications(id),
    is_read BOOLEAN DEFAULT false,
    PRIMARY KEY (student_id, notification_id)
);
```

### Queries matching Stage 1
**GET /notifications**
```sql
SELECT n.id, n.type, n.content, n.created_at, nr.is_read
FROM notifications n
JOIN notification_reads nr ON n.id = nr.notification_id
WHERE nr.student_id = $1 AND n.type = $2
ORDER BY n.created_at DESC
LIMIT $3 OFFSET $4;
```

### Scaling to 50k Students / 5M Notifications
*   **Problem**: `notification_reads` table will explode in size, slowing down JOINs.
*   **Solution**: Partition the `notification_reads` table by `student_id` or date range. Implement Redis caching for recent notifications, as older ones are rarely accessed. Move historical data to cold storage.

---

## Stage 3: Query Optimization

### Analyze Slow Query
`SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt ASC;`
*   **Why is it slow?**: Without an index, the database must perform a full table scan across potentially millions of rows to find those matching `studentID` and `isRead = false`, and then it must perform an expensive in-memory sort on `createdAt`.
*   **Accurate?**: Yes, it retrieves unread notifications for a student, ordered chronologically.

### Proposed Fix: Composite Index
```sql
CREATE INDEX idx_student_unread_created ON notifications (studentID, isRead, createdAt) WHERE isRead = false;
```

### Why Indexing Every Column is Bad
Indexing every column significantly degrades write performance (INSERT/UPDATE/DELETE) because every index must be updated synchronously. It also inflates the database storage size dramatically.

### Query for Recent Placement Notifications
```sql
SELECT DISTINCT s.student_id, s.name
FROM students s
JOIN notification_reads nr ON s.student_id = nr.student_id
JOIN notifications n ON nr.notification_id = n.id
WHERE n.type = 'Placement' AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4: Frontend & Delivery Strategies

*   **Redis Caching**: Highly effective for repeated identical queries (e.g., getting the top Priority notifications that are globally identical for many students).
    *   *Tradeoffs*: Cache invalidation can be tricky; data might be slightly stale.
*   **Pagination**: Good for structured historical browsing.
    *   *Tradeoffs*: `OFFSET` based pagination gets slower as pages go deeper.
*   **Lazy Loading / Infinite Scroll**: Great UX for mobile/feeds. 
    *   *Tradeoffs*: Harder to bookmark or jump to a specific past state.
*   **WebSocket Push (or SSE)**: Delivers notifications instantly.
    *   *Tradeoffs*: Requires persistent connections which consume server memory and complicates load balancing/scaling.

---

## Stage 5: Asynchronous Processing

### Critique of Synchronous notify_all()
If `notify_all()` iterates synchronously over 50,000 students, the HTTP request will time out. If the loop crashes at student 201 (e.g., due to an email API error), the remaining 49,799 students will never receive the notification.

### Redesign: Message Queue (Kafka/RabbitMQ)
DB inserts and email sending should be completely decoupled. The web server should instantly insert the DB record and then publish a message to a queue. Background worker processes consume the queue to handle the slow, error-prone email API calls independently.

### Revised Pseudocode
```python
def create_notification(type, content):
    # 1. Insert into DB (Fast)
    db.insert(Notification(type=type, content=content))
    
    # 2. Publish event to queue
    message_queue.publish('notification_events', {
        "type": type,
        "content": content
    })
    return "Notification queued"

# Background Worker Process
def worker():
    while True:
        msg = message_queue.consume('notification_events')
        students = db.get_all_students()
        for student in students:
            try:
                email_service.send(student.email, msg.content)
            except EmailException:
                # Retry logic: send back to queue or DLQ
                message_queue.publish('retry_queue', { "student": student.id, "msg": msg })
```

---

## Stage 6: Priority Algorithm

### Weight + Recency Algorithm
1.  Assign base weights: `Placement = 3`, `Result = 2`, `Event = 1`.
2.  If weights differ, higher weight wins.
3.  If weights are equal, standard timestamp comparison acts as the tie-breaker (`DESC` - newest wins).

### Maintaining Top-N Efficiently
Instead of sorting all `N` elements continuously (`O(N log N)`), we can use a **Min-Heap of size K** (where K is the top N needed, e.g., 10).
*   As new notifications arrive, they are compared against the root of the min-heap (the *lowest* priority item currently in our Top K).
*   If the new notification is higher priority, the root is popped and the new item is pushed. 
*   This keeps insertions at `O(log K)`. For `K=10`, this is virtually `O(1)`. This handles a real-time stream of millions of events perfectly without full re-sorting.
