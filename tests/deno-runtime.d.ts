// Minimal runtime contract used by the Edge Function while checking it in Node tests.
declare namespace Deno {
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
  namespace env { function get(name: string): string | undefined; }
}
