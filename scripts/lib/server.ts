import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';

/**
 * Start and stop a Vite server without leaking it.
 *
 * Every harness in this directory used to start one by hand, and every one of them did it wrongly
 * in the same way:
 *
 *     spawn('npx', ['vite', ...], { shell: true })          // three processes, not one
 *     spawn('taskkill', ['/pid', String(child.pid), '/t'])  // kills the wrong one
 *
 * `shell: true` starts a `cmd.exe`, which starts `npx`, which starts the real `vite`. The pid the
 * parent holds is the shell's, and by the time the kill runs `cmd` has usually already exited and
 * Windows has reparented the survivors, so the tree it walks is empty and the server lives on.
 * The consequences were not subtle: an orphan keeps the port, so the next run either fails on
 * `--strictPort` or — without it — quietly connects to whatever else is listening and photographs
 * a completely different working tree. And the orphan inherits the pipeline's stdio, so a command
 * whose output is piped anywhere never sees EOF and the task sits there looking busy. One did, for
 * an hour.
 *
 * The fix is not a better kill. It is to have no child process at all: Vite's own API runs the
 * server inside this process, so it dies exactly when the harness does, whatever kills it. There
 * is no pid to lose track of and no orphan that can outlive the run.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface ViteServer {
  readonly url: string;
  readonly port: number;
  /** Idempotent. Safe to call twice, and safe to call from an exit handler. */
  stop(): Promise<void>;
}

export type ViteMode = 'dev' | 'preview';

/**
 * Start Vite on `port` and resolve once it is listening.
 *
 * `strictPort` on both modes, deliberately. A harness that silently connects to whatever else is
 * on the port produces frames that look plausible and describe the wrong code, which is a far more
 * expensive failure than a crash.
 *
 * `preview` serves `dist/` and does NOT build it — see the note in HANDOFF.md. Build first, or you
 * will spend three minutes verifying the last bundle.
 */
export async function startVite(mode: ViteMode, port: number): Promise<ViteServer> {
  const common = { host: '127.0.0.1' as const, port, strictPort: true };

  let close: () => Promise<void>;
  let resolvedUrl: string | undefined;

  if (mode === 'preview') {
    const server = await preview({ root: ROOT, preview: common });
    resolvedUrl = server.resolvedUrls?.local[0];
    close = async () => {
      await server.close();
    };
  } else {
    const server = await createServer({ root: ROOT, server: common });
    await server.listen();
    resolvedUrl = server.resolvedUrls?.local[0];
    close = async () => {
      await server.close();
    };
  }

  const url = resolvedUrl ?? `http://127.0.0.1:${port}/`;
  let stopped = false;
  const server: ViteServer = {
    url,
    port,
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      await close();
    },
  };

  // Confirm it actually answers before handing it over. `listen` resolving is not the same claim,
  // and a harness that starts driving a browser at a server which is not serving yet produces a
  // blank first frame and a very confusing report.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 404) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  await server.stop();
  throw new Error(`vite ${mode} did not answer ${url} within 20 s`);
}
