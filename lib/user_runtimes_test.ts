import assert from "node:assert/strict";
import { docsRoute } from "./routes/docs.ts";
import { importRoute } from "./routes/import.ts";
import { authenticateUser, closeUserRuntimes, createUserRuntimes } from "./user_runtimes.ts";

Deno.test("routes passwords to isolated user databases", async () => {
  const dataFolder = await Deno.makeTempDir();
  const runtimes = createUserRuntimes({
    users: JSON.stringify({ alice: "alice-password", bob: "bob-password" }),
    password: undefined,
    dataFolder,
    anthropicApiKey: "",
    geminiApiKey: "",
  });

  try {
    const alice = authenticateUser(runtimes, "Bearer alice-password");
    const bob = authenticateUser(runtimes, "Bearer bob-password");
    assert.ok(alice);
    assert.ok(bob);
    assert.equal(alice.name, "alice");
    assert.equal(bob.name, "bob");
    assert.notStrictEqual(alice.db, bob.db);
    assert.equal(authenticateUser(runtimes, "Bearer unknown"), undefined);

    const response = await importRoute(alice.db)(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: JSON.stringify({ slug: "training-program", content: "Alice's program" }),
      }),
    );
    assert.equal(response.status, 200);

    const aliceDocument = await docsRoute(alice.db, "training-program")(
      new Request("http://localhost/api/docs/training-program"),
    );
    const bobDocument = await docsRoute(bob.db, "training-program")(
      new Request("http://localhost/api/docs/training-program"),
    );
    assert.equal(await aliceDocument.text(), "Alice's program");
    assert.equal(await bobDocument.text(), "");
  } finally {
    closeUserRuntimes(runtimes);
    await Deno.remove(dataFolder, { recursive: true });
  }
});

Deno.test("keeps PASSWORD data in the legacy data.db", async () => {
  const dataFolder = await Deno.makeTempDir();
  const options = {
    users: undefined,
    password: "legacy-password",
    dataFolder,
    anthropicApiKey: "",
    geminiApiKey: "",
  };

  try {
    const firstRuntimes = createUserRuntimes(options);
    try {
      const runtime = authenticateUser(firstRuntimes, "Bearer legacy-password");
      assert.ok(runtime);
      await importRoute(runtime.db)(
        new Request("http://localhost/api/import", {
          method: "POST",
          body: JSON.stringify({ slug: "training-program", content: "Legacy program" }),
        }),
      );
      assert.equal((await Deno.stat(`${dataFolder}/data.db`)).isFile, true);
    } finally {
      closeUserRuntimes(firstRuntimes);
    }

    const reopenedRuntimes = createUserRuntimes(options);
    try {
      const runtime = authenticateUser(reopenedRuntimes, "Bearer legacy-password");
      assert.ok(runtime);
      const document = await docsRoute(runtime.db, "training-program")(
        new Request("http://localhost/api/docs/training-program"),
      );
      assert.equal(await document.text(), "Legacy program");
    } finally {
      closeUserRuntimes(reopenedRuntimes);
    }
  } finally {
    await Deno.remove(dataFolder, { recursive: true });
  }
});

Deno.test("rejects invalid user mappings before opening databases", async () => {
  const dataFolder = await Deno.makeTempDir();
  const options = {
    password: undefined,
    dataFolder,
    anthropicApiKey: "",
    geminiApiKey: "",
  };

  try {
    assert.throws(
      () =>
        createUserRuntimes({
          ...options,
          users: JSON.stringify({ alice: "same-password", bob: "same-password" }),
        }),
      /duplicate passwords/,
    );
    assert.throws(
      () =>
        createUserRuntimes({
          ...options,
          users: JSON.stringify({ "../alice": "alice-password" }),
        }),
      /Invalid user name/,
    );
    assert.throws(
      () =>
        createUserRuntimes({
          ...options,
          users: JSON.stringify({ alice: "alice-password", Alice: "other-password" }),
        }),
      /user names that differ only by case/,
    );
    for (const password of ["trailing-space ", "line\nbreak"]) {
      assert.throws(
        () =>
          createUserRuntimes({
            ...options,
            users: JSON.stringify({ alice: password }),
          }),
        /not a valid bearer credential/,
      );
    }
    assert.deepEqual(Array.from(Deno.readDirSync(dataFolder)), []);
  } finally {
    await Deno.remove(dataFolder, { recursive: true });
  }
});
