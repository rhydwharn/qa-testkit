export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";

  // Mask the password
  const maskedUrl = dbUrl.replace(/:[^@]*@/, ":***@");

  return Response.json({
    database_url_set: dbUrl !== "NOT SET",
    masked_url: maskedUrl,
    host: dbUrl.split("@")[1]?.split(":")[0] || "UNKNOWN",
    port: dbUrl.split(":").pop()?.split("/")[0] || "UNKNOWN",
    node_env: process.env.NODE_ENV,
  });
}
