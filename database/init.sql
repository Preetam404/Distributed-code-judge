CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    language VARCHAR(20) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    output TEXT,
    error TEXT,
    execution_time_ms INTEGER
);