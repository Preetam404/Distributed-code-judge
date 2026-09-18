import { Pool } from "pg";

export const pool = new Pool({
    user: "judge",
    password: "judgepassword",
    host: "localhost",
    port: 5432,
    database: "codejudge"
});