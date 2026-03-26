export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  let parsed: URL;

  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  const allowedHosts = ["users.roblox.com", "thumbnails.roblox.com"];

  if (!allowedHosts.includes(parsed.hostname)) {
    return new Response("Blocked host", { status: 400 });
  }

  const res = await fetch(parsed.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}