import fs from "fs";
import path from "path";

const cache = new Map<string, string>();

/**
 * Load a prompt from a .md file in the prompts directory.
 * Supports {{VAR}} template variables via the `vars` parameter.
 *
 * @example
 * loadPrompt("calendar", { TODAY: "วันจันทร์ที่ 7 มีนาคม 2569" })
 */
export function loadPrompt(
  name: string,
  vars?: Record<string, string>,
): string {
  let content = cache.get(name);

  if (!content) {
    const filePath = path.join(__dirname, `${name}.md`);
    content = fs.readFileSync(filePath, "utf-8").trim();
    cache.set(name, content);
  }

  if (vars) {
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }

  return content;
}
