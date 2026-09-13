# Distributed Code Judge

A distributed, asynchronous code execution system that allows users to submit C++ programs through a REST API, executes them in isolated Docker containers, and returns the execution result.

The system uses a **queue-based architecture** to decouple API request handling from code execution, allowing the execution layer to scale independently by adding more workers.

## Architecture

```text
                    ┌──────────────┐
                    │    Client    │
                    │   (Postman)  │
                    └──────┬───────┘
                           │
                           │ HTTP
                           ▼
                    ┌──────────────┐
                    │  Fastify API │
                    │   Node.js    │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │  PostgreSQL  │          │ Redis/BullMQ │
       │              │          │    Queue     │
       │ Submissions  │          └──────┬───────┘
       └──────────────┘                 │
                                        │
                                        ▼
                                ┌──────────────┐
                                │    Worker    │
                                │              │
                                └──────┬───────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │    Docker    │
                                │   Sandbox    │
                                │              │
                                │ Compile +    │
                                │ Execute C++  │
                                └──────┬───────┘
                                       │
                                       ▼
                                Execution Result
                                       │
                                       ▼
                                  PostgreSQL
```

## How It Works

### 1. Submit Code

The client sends a `POST` request containing the programming language and source code.

```http
POST /submissions
```

Example:

```json
{
  "language": "cpp",
  "code": "#include <iostream>\nint main() { std::cout << \"Hello\"; }"
}
```

The API:

1. Generates a unique submission UUID.
2. Stores the submission in PostgreSQL.
3. Creates a BullMQ job containing the submission ID.
4. Places the job into Redis.
5. Immediately returns the submission ID to the client.

Example response:

```json
{
  "submissionId": "642745fb-cba9-44df-bcb3-1743ac05248a",
  "status": "QUEUED",
  "language": "cpp"
}
```

### 2. Queue-Based Processing

The API does not execute submitted code itself.

Instead, the submission is placed into a Redis-backed BullMQ queue.

```text
API
 │
 ▼
Redis Queue
 │
 ▼
Worker
```

This makes code execution asynchronous and prevents expensive execution tasks from blocking API requests.

It also allows multiple workers to consume jobs from the same queue.

### 3. Worker

A separate worker process continuously listens for jobs in the queue.

When a job is received, the worker:

* Retrieves the submission ID.
* Fetches the source code from PostgreSQL.
* Changes the submission status to `RUNNING`.
* Starts the code execution process.

### 4. Docker-Based Execution

Submitted C++ code is compiled and executed inside a temporary Docker container.

The execution environment currently includes:

* GCC compiler
* 5-second execution timeout
* 128 MB memory limit
* 0.5 CPU limit
* Network access disabled

The container is removed after execution.

This provides isolation between submitted programs and the host environment.

### 5. Result Persistence

After execution, the worker stores the result in PostgreSQL.

The system records:

* Execution status
* Program output
* Error messages
* Execution time

Possible states include:

```text
QUEUED
RUNNING
COMPLETED
COMPILATION_ERROR
TIME_LIMIT_EXCEEDED
```

### 6. Retrieve Submission Result

Clients can retrieve the result using the submission UUID:

```http
GET /submissions/{submissionId}
```

Example:

```json
{
  "id": "642745fb-cba9-44df-bcb3-1743ac05248a",
  "language": "cpp",
  "status": "COMPLETED",
  "output": "Hello",
  "error": "",
  "execution_time_ms": 2604,
  "created_at": "2026-08-22T19:12:43.928Z"
}
```

## Tech Stack

| Component        | Technology                   |
| ---------------- | ---------------------------- |
| API              | Node.js, TypeScript, Fastify |
| Database         | PostgreSQL                   |
| Queue            | Redis, BullMQ                |
| Code Execution   | Docker                       |
| Language Runtime | GCC / C++                    |
| Development      | npm, tsx                     |

## Project Structure

```text
distributed-code-judge/
│
├── api/
│   ├── src/
│   │   ├── server.ts       # REST API
│   │   ├── worker.ts       # Background job worker
│   │   ├── db.ts           # PostgreSQL connection
│   │   └── redis.ts        # Redis connection
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── database/
│   └── init.sql            # Database schema
│
├── docker-compose.yml      # PostgreSQL and Redis services
└── README.md
```

## Running Locally

### Prerequisites

Make sure the following are installed:

* Node.js
* Docker Desktop
* npm

### 1. Start Infrastructure

From the project root:

```bash
docker compose up -d
```

This starts:

* PostgreSQL
* Redis

### 2. Initialize the Database

```bash
docker exec -i code-judge-postgres psql -U judge -d codejudge < database/init.sql
```

### 3. Start the API

```bash
cd api
npm install
npm run dev
```

The API runs on:

```text
http://localhost:3000
```

### 4. Start the Worker

Open another terminal:

```bash
cd api
npm run worker
```

The worker will listen for new submissions from the Redis/BullMQ queue.

## API Endpoints

### Submit Code

```http
POST /submissions
```

Request:

```json
{
  "language": "cpp",
  "code": "#include <iostream>\nint main() { std::cout << \"Hello\"; }"
}
```

### Get Submission

```http
GET /submissions/{submissionId}
```

Returns the current status and execution result.

## Example Execution Flow

```text
POST /submissions
        │
        ▼
Generate UUID
        │
        ▼
Store submission
in PostgreSQL
        │
        ▼
Create BullMQ job
        │
        ▼
Redis Queue
        │
        ▼
Worker consumes job
        │
        ▼
Fetch code from PostgreSQL
        │
        ▼
Run inside Docker
        │
        ├── Compilation Error
        ├── Timeout
        └── Successful Execution
        │
        ▼
Store result in PostgreSQL
        │
        ▼
GET /submissions/{id}
```

## Future Improvements

The project can be extended with:

* Multiple programming language support
* Safer source-code/file handling
* Stronger Docker sandbox isolation
* Runtime error classification
* CPU and memory monitoring
* Job retries and failure recovery
* Multiple worker instances for horizontal scaling
* Concurrent submission/load testing
* Frontend for code submission and result visualization

## Key Distributed Systems Concepts

This project demonstrates several practical distributed-systems concepts:

* **Asynchronous job processing**
* **Producer-consumer architecture**
* **Message queues**
* **Horizontal worker scaling**
* **Separation of API and compute workloads**
* **Container-based isolation**
* **Persistent state management**
* **Failure and timeout handling**
* **Resource isolation**
