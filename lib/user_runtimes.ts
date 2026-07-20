import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { Agent } from "./agent/agent.ts";
import { migrateDocuments, migrateSchema } from "./db/migrate.ts";

interface UserRuntime {
  db: DatabaseSync;
  agent: Agent;
  password: string;
}

interface UserRuntimeOptions {
  users: string | undefined;
  password: string | undefined;
  dataFolder: string;
  anthropicApiKey: string;
  geminiApiKey: string;
}

function parseUsers(users: string | undefined, password: string | undefined) {
  if (!users) {
    return [{ name: "data", password: password || crypto.randomUUID() }];
  }
  if (password) {
    throw new Error("Configure either USERS or PASSWORD, not both");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(users);
  } catch {
    throw new Error("USERS must be a JSON object mapping user names to passwords");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("USERS must be a JSON object mapping user names to passwords");
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    throw new Error("USERS must contain at least one user");
  }

  const passwords = new Set<string>();
  return entries.map(([name, userPassword]) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid user name: ${name}`);
    }
    if (typeof userPassword !== "string" || !userPassword) {
      throw new Error(`Password for user ${name} must be a non-empty string`);
    }
    if (passwords.has(userPassword)) {
      throw new Error("USERS must not contain duplicate passwords");
    }
    passwords.add(userPassword);
    return { name, password: userPassword };
  });
}

function createUserRuntimes(options: UserRuntimeOptions): Map<string, UserRuntime> {
  const users = parseUsers(options.users, options.password);
  const runtimes = new Map<string, UserRuntime>();

  try {
    for (const user of users) {
      const db = new DatabaseSync(join(options.dataFolder, `${user.name}.db`));
      try {
        migrateSchema(db);
        migrateDocuments(db);
        runtimes.set(user.password, {
          db,
          agent: new Agent(options.anthropicApiKey, options.geminiApiKey, db),
          password: user.password,
        });
      } catch (error) {
        db.close();
        throw error;
      }
    }
  } catch (error) {
    closeUserRuntimes(runtimes);
    throw error;
  }

  return runtimes;
}

function authenticateUser(
  runtimes: Map<string, UserRuntime>,
  authorization: string | null,
): UserRuntime | undefined {
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  return runtimes.get(authorization.slice("Bearer ".length));
}

function closeUserRuntimes(runtimes: Map<string, UserRuntime>): void {
  for (const runtime of runtimes.values()) {
    runtime.db.close();
  }
}

export { authenticateUser, closeUserRuntimes, createUserRuntimes, type UserRuntime };
