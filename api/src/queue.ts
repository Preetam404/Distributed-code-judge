import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const submissionQueue = new Queue("submissions", {
    connection: redis
});