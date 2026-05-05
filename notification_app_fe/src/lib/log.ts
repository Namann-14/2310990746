export type LogStack = "backend" | "frontend";
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type BackendPackage = "cache" | "controller" | "cron_job" | "db" | "domain" | "handler" | "repository" | "route" | "service" | "auth" | "config" | "middleware" | "utils";
export type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style" | "auth" | "config" | "middleware" | "utils";

export async function Log(
  stack: LogStack,
  level: LogLevel,
  pkg: BackendPackage | FrontendPackage,
  message: string
): Promise<void> {
  try {
    const accessToken = process.env.NEXT_PUBLIC_ACCESS_TOKEN;
    if (!accessToken) return;

    await fetch("/evaluation-service/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ 
        stack: stack.padEnd(5, ' '), 
        level: level.padEnd(5, ' '), 
        package: pkg.padEnd(5, ' '), 
        message: message.padEnd(5, ' '),
        timestamp: new Date().toISOString()
      }),
    });
  } catch {
    // Fail silently
  }
}

export const logInfo  = (stack: LogStack, pkg: BackendPackage | FrontendPackage, message: string) => Log(stack, "info",  pkg, message);
export const logError = (stack: LogStack, pkg: BackendPackage | FrontendPackage, message: string) => Log(stack, "error", pkg, message);
export const logDebug = (stack: LogStack, pkg: BackendPackage | FrontendPackage, message: string) => Log(stack, "debug", pkg, message);
export const logWarn  = (stack: LogStack, pkg: BackendPackage | FrontendPackage, message: string) => Log(stack, "warn",  pkg, message);
export const logFatal = (stack: LogStack, pkg: BackendPackage | FrontendPackage, message: string) => Log(stack, "fatal", pkg, message);
