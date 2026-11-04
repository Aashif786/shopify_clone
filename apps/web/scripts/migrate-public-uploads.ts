import path from "node:path";
import { migratePublicUploads } from "../src/lib/public-upload-migration.js";

const webRoot = path.resolve(process.cwd(), process.argv[2] ?? path.join("apps", "web"));
const result = await migratePublicUploads(webRoot);
console.log(JSON.stringify(result));
