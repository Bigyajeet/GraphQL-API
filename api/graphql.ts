import { yoga } from "../src/server";

export default async function handler(req: any, res: any) {
  try {
    return await yoga(req, res);
  } catch (err: any) {
    console.error("Vercel Yoga Handler Error:", err);
    res.status(500).json({
      error: "Vercel Serverless Execution Error",
      message: err?.message || String(err),
    });
  }
}
