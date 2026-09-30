import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const bootstrapToken = "B".repeat(43);
const sessionToken = "S".repeat(43);
const metadata = {
	objectKey: "uploads/private-object-key",
	filename: "secret report.txt",
	contentType: "text/plain",
	size: 11,
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function mockBucket(body = "hello world", size = 11) {
	return {
		head: vi.fn(async () => ({ size })),
		get: vi.fn(async (_key: string, options?: { range?: { offset: number; length: number } }) => {
			if (options?.range) {
				const bytes = new TextEncoder().encode(body);
				const ranged = bytes.slice(options.range.offset, options.range.offset + options.range.length);
				return { size, body: new Response(ranged).body };
			}
			return { size, body: new Response(body).body };
		}),
	};
}

function testEnv(bucket: unknown = mockBucket()) {
	return {
		SENDORA_BUCKET: bucket,
		DOWNLOAD_API_URL: "https://api.example/api",
		DOWNLOAD_WORKER_SECRET: "worker-secret-value-that-is-long-enough",
	} as unknown as Parameters<typeof worker.fetch>[1];
}

function mockApi(options: { claim?: unknown; validate?: unknown } = {}) {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	let claimUsed = false;
	vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		const payload = JSON.parse(String(init?.body)) as { token: string };
		const isClaim = url.endsWith("/claim");
		const responseBody = isClaim
			? claimUsed ? undefined : options.claim
			: options.validate;
		if (isClaim) claimUsed = true;
		if (!responseBody) return Response.json({ error: "unavailable" }, { status: 404 });
		return Response.json(responseBody);
	}));
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("download Worker", () => {
	it("rejects invalid bootstrap credentials without contacting R2", async () => {
		mockApi();
		const bucket = mockBucket();
		const response = await worker.fetch(
			new Request(`https://worker.example/download/${bootstrapToken}`),
			testEnv(bucket),
		);
		expect(response.status).toBe(404);
		expect(bucket.get).not.toHaveBeenCalled();
	});

	it("claims bootstrap once, keeps the session in an HttpOnly cookie, and redirects to a clean URL", async () => {
		const calls = mockApi({ claim: { ...metadata, sessionToken } });
		const request = new Request(`https://worker.example/download/${bootstrapToken}`);
		const response = await worker.fetch(request, testEnv());
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("https://worker.example/file");
		expect(response.headers.get("set-cookie")).toContain(`sendora_session=${sessionToken}`);
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
		expect(response.headers.get("set-cookie")).toContain("Path=/file");
		expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(calls[0].url).toBe("https://api.example/api/internal/download-sessions/claim");
		expect(calls[0].init?.headers).toMatchObject({ Authorization: "Bearer worker-secret-value-that-is-long-enough" });
		expect(calls[0].init?.body).toBe(JSON.stringify({ token: bootstrapToken }));

		const replay = await worker.fetch(request, testEnv());
		expect(replay.status).toBe(404);
	});

	it("streams private R2 bytes without redirecting or exposing the object key", async () => {
		const calls = mockApi({ validate: metadata });
		const bucket = mockBucket();
		const response = await worker.fetch(new Request("https://worker.example/file", {
			headers: { Cookie: `sendora_session=${sessionToken}` },
		}), testEnv(bucket));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain("secret report.txt");
		expect(response.headers.get("content-length")).toBe("11");
		expect(response.headers.get("content-type")).toBe("text/plain");
		expect(await response.text()).toBe("hello world");
		expect(bucket.get).toHaveBeenCalledWith(metadata.objectKey);
		expect(response.headers.get("location")).toBeNull();
		expect(JSON.stringify({ url: response.url, headers: [...response.headers] })).not.toContain(metadata.objectKey);
		expect(calls).toHaveLength(1);
		expect(JSON.stringify(calls[0].init?.headers)).toContain("worker-secret");
	});

	it("validates byte ranges and streams the requested interval", async () => {
		mockApi({ validate: metadata });
		const bucket = mockBucket();
		const response = await worker.fetch(new Request("https://worker.example/file", {
			headers: { Cookie: `sendora_session=${sessionToken}`, Range: "bytes=2-5" },
		}), testEnv(bucket));
		expect(response.status).toBe(206);
		expect(response.headers.get("content-range")).toBe("bytes 2-5/11");
		expect(response.headers.get("content-length")).toBe("4");
		expect(response.headers.get("accept-ranges")).toBe("bytes");
		expect(await response.text()).toBe("llo ");
		expect(bucket.get).toHaveBeenCalledWith(metadata.objectKey, { range: { offset: 2, length: 4 } });
	});

	it.each(["bytes=0-1,3-4", "bytes=99-", "bytes=-0", "bytes=7-2", "items=0-1"])(
		"rejects malformed or unsatisfiable range %s safely",
		async (range) => {
			mockApi({ validate: metadata });
			const bucket = mockBucket();
			const response = await worker.fetch(new Request("https://worker.example/file", {
				headers: { Cookie: `sendora_session=${sessionToken}`, Range: range },
			}), testEnv(bucket));
			expect(response.status).toBe(416);
			expect(response.headers.get("content-range")).toBe("bytes */11");
			expect(bucket.get).not.toHaveBeenCalled();
		},
	);

	it("rejects an invalid or expired active session", async () => {
		const calls = mockApi();
		const bucket = mockBucket();
		const response = await worker.fetch(new Request("https://worker.example/file", {
			headers: { Cookie: `sendora_session=${sessionToken}` },
		}), testEnv(bucket));
		expect(response.status).toBe(404);
		expect(bucket.get).not.toHaveBeenCalled();
		expect(calls[0].url).toContain("/validate");
	});

	it("returns a safe missing-object response and supports HEAD without a body", async () => {
		mockApi({ validate: metadata });
		const missingBucket = { head: vi.fn(async () => null), get: vi.fn(async () => null) };
		const missingGet = await worker.fetch(new Request("https://worker.example/file", {
			headers: { Cookie: `sendora_session=${sessionToken}` },
		}), testEnv(missingBucket));
		expect(missingGet.status).toBe(404);

		mockApi({ validate: metadata });
		const missingHead = await worker.fetch(new Request("https://worker.example/file", {
			method: "HEAD", headers: { Cookie: `sendora_session=${sessionToken}` },
		}), testEnv(missingBucket));
		expect(missingHead.status).toBe(404);

		mockApi({ validate: metadata });
		const bucket = mockBucket();
		const response = await worker.fetch(new Request("https://worker.example/file", {
			method: "HEAD", headers: { Cookie: `sendora_session=${sessionToken}` },
		}), testEnv(bucket));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-length")).toBe("11");
		expect(await response.text()).toBe("");
		expect(bucket.head).toHaveBeenCalledWith(metadata.objectKey);
		expect(bucket.get).not.toHaveBeenCalled();
	});
});
