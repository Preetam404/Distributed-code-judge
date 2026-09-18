import Fastify from "fastify";
import { v4 as uuidv4 } from "uuid";
import { pool } from "./db.js";
import { submissionQueue } from "./queue.js";

const app = Fastify({
  logger: true
});

app.get("/", async () => {
  return {
    message: "Distributed Code Judge API"
  };
});

app.post("/submissions", async (request, reply) => {
    const body = request.body as {
        language: string;
        code: string;
    };
    const submissionId = uuidv4();

    await pool.query(
        `INSERT INTO submissions (id, language, code, status)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, body.language, body.code, "QUEUED"]
    );

    await submissionQueue.add("execute-submission", {
        submissionId,
    });

    return {
        submissionId,
        status: "QUEUED",
        language: body.language
    };
});

app.get("/submissions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
        `SELECT id, language, status, output, error, execution_time_ms, created_at
         FROM submissions
         WHERE id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return reply.code(404).send({
            message: "Submission not found"
        });
    }

    return result.rows[0];
});

const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0"
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();