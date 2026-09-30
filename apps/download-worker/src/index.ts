type WorkerEnv = Env & {
  DOWNLOAD_API_URL: string;
  DOWNLOAD_WORKER_SECRET: string;
};

type DownloadMetadata = {
  objectKey: string;
  filename: string;
  contentType: string;
  size: number;
  expiresAt: string;
};

type ClaimedDownload = DownloadMetadata & { sessionToken: string };

function jsonError(status: number, message: string, headers?: HeadersInit) {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Cache-Control", "no-store");
  resultHeaders.set("Referrer-Policy", "no-referrer");
  return Response.json({ error: message }, { status, headers: resultHeaders });
}

function apiEndpoint(env: WorkerEnv, path: string) {
  return `${env.DOWNLOAD_API_URL.replace(/\/+$/, "")}${path}`;
}

async function apiPost<T>(env: WorkerEnv, path: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(apiEndpoint(env, path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DOWNLOAD_WORKER_SECRET}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

function contentDisposition(filename: string) {
  const cleaned = filename.replace(/[\u0000-\u001f\u007f-\u009f/\\]/g, "_").trim();
  const safeName = !cleaned || cleaned === "." || cleaned === ".." ? "download" : cleaned;
  const fallback = safeName.replace(/[^A-Za-z0-9 .()_-]/g, "_");
  const encoded = encodeURIComponent(safeName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function parseSingleRange(header: string, size: number) {
  if (!/^bytes=\d*-\d*$/.test(header) || header === "bytes=-") return null;
  const range = header.slice(6);
  const [startText, endText] = range.split("-");
  if (size <= 0) return null;

  let start: number;
  let end: number;
  if (startText === "") {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === "" ? size - 1 : Number(endText);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

function isDownloadMetadata(value: unknown): value is DownloadMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<DownloadMetadata>;
  return typeof metadata.objectKey === "string" && metadata.objectKey.length > 0
    && typeof metadata.filename === "string" && metadata.filename.length <= 255
    && typeof metadata.contentType === "string" && metadata.contentType.length <= 255
    && typeof metadata.size === "number" && Number.isSafeInteger(metadata.size) && metadata.size >= 0
    && typeof metadata.expiresAt === "string" && Number.isFinite(Date.parse(metadata.expiresAt));
}

export default {
  async fetch(request: Request, rawEnv: WorkerEnv): Promise<Response> {
    const env = rawEnv;
    const url = new URL(request.url);
    const bootstrapMatch = url.pathname.match(/^\/download\/([A-Za-z0-9_-]{43})$/);

    if (bootstrapMatch) {
      if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });

      const claimed = await apiPost<ClaimedDownload>(
        env,
        "/internal/download-sessions/claim",
        bootstrapMatch[1],
      );
      if (!claimed || !isDownloadMetadata(claimed) ||
          typeof claimed.sessionToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(claimed.sessionToken)) {
        return jsonError(404, "Download unavailable");
      }

      const expiresAt = Date.parse(claimed.expiresAt);
      const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
      if (maxAge <= 0) return jsonError(404, "Download unavailable");

      const headers = new Headers({
        Location: new URL("/file", url.origin).toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      headers.append("Set-Cookie",
		`sendora_session=${claimed.sessionToken}; Path=/file; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Expires=${new Date(expiresAt).toUTCString()}`,
      );
      return new Response(null, { status: 303, headers });
    }

    if (url.pathname !== "/file") return new Response("Not found", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const sessionToken = cookieValue(request, "sendora_session");
    if (!sessionToken || !/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) {
      return jsonError(404, "Download unavailable");
    }

    const metadata = await apiPost<DownloadMetadata>(
      env,
      "/internal/download-sessions/validate",
      sessionToken,
    );
    if (!metadata || !isDownloadMetadata(metadata)) return jsonError(404, "Download unavailable");

    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(metadata.filename),
      "Content-Type": /^[\x20-\x7e]{1,255}$/.test(metadata.contentType)
        ? metadata.contentType
        : "application/octet-stream",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });

    if (request.method === "HEAD") {
      let object: R2Object | null;
      try {
        object = await env.SENDORA_BUCKET.head(metadata.objectKey);
      } catch {
        return jsonError(502, "Unable to retrieve download");
      }
      if (!object || object.size !== metadata.size) return jsonError(404, "Download unavailable");
      headers.set("Content-Length", String(metadata.size));
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get("Range");
    let object: R2ObjectBody | R2Object | null;
    let status = 200;
    if (rangeHeader !== null) {
      const range = parseSingleRange(rangeHeader, metadata.size);
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${metadata.size}`,
            "Cache-Control": "no-store",
          },
        });
      }
      try {
        object = await env.SENDORA_BUCKET.get(metadata.objectKey, {
          range: { offset: range.start, length: range.end - range.start + 1 },
        });
      } catch {
        return jsonError(502, "Unable to retrieve download");
      }
      if (!object || !("body" in object) || !object.body || object.size !== metadata.size) {
        return jsonError(404, "Download unavailable");
      }
      status = 206;
      headers.set("Content-Length", String(range.end - range.start + 1));
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${metadata.size}`);
    } else {
      try {
        object = await env.SENDORA_BUCKET.get(metadata.objectKey);
      } catch {
        return jsonError(502, "Unable to retrieve download");
      }
      if (!object || !("body" in object) || !object.body || object.size !== metadata.size) {
        return jsonError(404, "Download unavailable");
      }
      headers.set("Content-Length", String(metadata.size));
    }

    return new Response(object.body, { status, headers });
  },
} satisfies ExportedHandler<WorkerEnv>;
