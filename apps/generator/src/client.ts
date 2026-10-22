export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Darmowy hosting usypia aplikację; health check budzi ją przed właściwą wysyłką.
export async function waitForApi(base: string, attempts = 12, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return;
    } catch {
      // cold start lub brak sieci: próbujemy ponownie
    }
    console.log(`API not ready (attempt ${attempt}/${attempts}), waiting...`);
    await sleep(delayMs);
  }
  throw new Error(`API at ${base} did not respond to /api/health`);
}

export type SendResult = { ok: true; id: string } | { ok: false; status: number; detail: string };

export async function postMeasurement(
  base: string,
  apiKey: string,
  value: number,
  timestamp?: string,
): Promise<SendResult> {
  const res = await fetch(`${base}/api/measurements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(timestamp ? { value, timestamp } : { value }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 201) {
    const body = (await res.json()) as { id: string };
    return { ok: true, id: body.id };
  }
  const problem = (await res.json().catch(() => null)) as {
    title?: string;
    detail?: string;
    errors?: { field: string; message: string }[];
  } | null;
  const fields = problem?.errors?.map((e) => `${e.field} ${e.message}`).join("; ");
  const summary = problem?.detail ?? problem?.title ?? res.statusText;
  return { ok: false, status: res.status, detail: fields ? `${summary} (${fields})` : summary };
}