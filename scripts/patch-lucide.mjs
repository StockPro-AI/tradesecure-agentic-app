import fs from "fs";
import path from "path";

const target = path.join(
  process.cwd(),
  "node_modules",
  "lucide-react",
  "dynamicIconImports.js"
);

if (!fs.existsSync(target)) {
  fs.writeFileSync(
    target,
    "export { default } from './dynamicIconImports.mjs';\n"
  );
  console.log("Patched lucide-react dynamicIconImports.js");
}
