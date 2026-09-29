import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "../db";

async function testDatabase() {
  const result = await db.execute(sql`
    SELECT current_database() AS database_name,
           current_user AS user_name,
           NOW() AS current_time
  `);

  console.log(result);
  process.exit(0);
}

testDatabase();