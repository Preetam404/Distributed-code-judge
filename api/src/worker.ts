import { Worker } from "bullmq";
import { redis } from "./redis.js";
import { pool } from "./db.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const worker = new Worker(
    "submissions",
    async (job) => {
        const { submissionId } = job.data;

        console.log("Processing submission:", submissionId);

        await pool.query(
            `UPDATE submissions
            SET status = 'RUNNING'
            WHERE id = $1`,
            [submissionId]
        );

        const result = await pool.query(
            `SELECT * FROM submissions WHERE id = $1`,
            [submissionId]
        );

        const submission = result.rows[0];

        if (!submission) {
            throw new Error(`Submission ${submissionId} not found`);
        }

        console.log("Language:", submission.language);
        console.log("Code:", submission.code);

        const startTime = Date.now();

        try {
            const { stdout, stderr } = await execFileAsync(
            "docker",
            [
                "run",
                "--rm",
                "--memory=128m",
                "--cpus=0.5",
                "--network=none",
                "gcc:latest",
                "sh",
                "-c",
                `echo '${submission.code}' > main.cpp && g++ main.cpp -o main && ./main`
            ],
            {
                timeout: 5000
            }
        );

            const executionTime = Date.now() - startTime;

            await pool.query(
                `UPDATE submissions
                SET status = 'COMPLETED',
                    output = $1,
                    error = $2,
                    execution_time_ms = $3
                WHERE id = $4`,
                [stdout, stderr, executionTime, submissionId]
            );

            console.log("Program output:", stdout);
            console.log("Program errors:", stderr);

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            const timedOut = error.killed === true;

            const status = timedOut
                ? "TIME_LIMIT_EXCEEDED"
                : "COMPILATION_ERROR";

            const errorMessage = timedOut
                ? "Execution exceeded the 5 second time limit."
                : (error.stderr || error.message);

            await pool.query(
                `UPDATE submissions
                SET status = $1,
                    output = $2,
                    error = $3,
                    execution_time_ms = $4
                WHERE id = $5`,
                [
                    status,
                    error.stdout || "",
                    errorMessage,
                    executionTime,
                    submissionId
                ]
            );

            console.log("Execution failed:", errorMessage);
        }
    },
    {
        connection: redis
    }
);

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
});