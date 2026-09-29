import "dotenv/config";
import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { r2 } from "../lib/r2";

const bucket = process.env.R2_BUCKET_NAME;

if (!bucket) {
  throw new Error("Missing R2_BUCKET_NAME");
}

const testR2 = async () => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: "test/hello.txt",
    Body: "Hello from Sendora!",
    ContentType: "text/plain",
  });

  await r2.send(command);

  console.log("Successfully uploaded test/hello.txt to R2");

  const getCommand = new GetObjectCommand({
  Bucket: bucket,
  Key: "test/hello.txt",
});

const response = await r2.send(getCommand);

const body = await response.Body?.transformToString();

console.log("Downloaded from R2:", body);
};

testR2().catch((error) => {
  console.error("R2 test failed:", error);
  process.exit(1);
});