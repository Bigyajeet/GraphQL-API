import { yoga } from "../src/server";

export default async function handler(request: Request) {
  return yoga.fetch(request);
}
