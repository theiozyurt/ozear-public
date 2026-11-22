import { teachingContext } from "../learning-guide";
import type { ExecutionContext } from "../service";
export async function get_context({}: ExecutionContext): Promise<unknown> {
  return { learningContext: teachingContext };
}
