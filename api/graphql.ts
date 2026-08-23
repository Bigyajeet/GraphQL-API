import { yoga } from "../src/server";

export default async function handler(req: any, res: any) {
  return yoga(req, res);
}
