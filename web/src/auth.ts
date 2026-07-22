interface SavedUser {
  name: string;
  token: string;
}

const USERS_KEY = "users";
const TOKEN_KEY = "token";

function getActiveToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

function getSavedUsers(): SavedUser[] {
  const value = window.localStorage.getItem(USERS_KEY);
  if (value === null) return [];

  try {
    const users: unknown = JSON.parse(value);
    if (
      !Array.isArray(users) ||
      !users.every(
        (user) =>
          typeof user === "object" &&
          user !== null &&
          "name" in user &&
          typeof user.name === "string" &&
          "token" in user &&
          typeof user.token === "string",
      )
    ) {
      throw new Error("Invalid saved users");
    }
    return users as SavedUser[];
  } catch {
    window.localStorage.removeItem(USERS_KEY);
    return [];
  }
}

function setSavedUsers(users: SavedUser[]): void {
  if (users.length === 0) {
    window.localStorage.removeItem(USERS_KEY);
  } else {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

function saveUser(user: SavedUser): void {
  const users = getSavedUsers();
  const index = users.findIndex(
    (savedUser) => savedUser.name === user.name || savedUser.token === user.token,
  );
  if (index === -1) {
    users.push(user);
  } else {
    users[index] = user;
  }
  setSavedUsers(users);
  window.localStorage.setItem(TOKEN_KEY, user.token);
}

function activateUser(user: SavedUser): void {
  window.localStorage.setItem(TOKEN_KEY, user.token);
}

function forgetUser(token: string): void {
  setSavedUsers(getSavedUsers().filter((user) => user.token !== token));
  if (getActiveToken() === token) {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function logout(): boolean {
  const token = getActiveToken();
  if (token === null) return false;

  const users = getSavedUsers().filter((user) => user.token !== token);
  setSavedUsers(users);
  if (users.length === 0) {
    window.localStorage.removeItem(TOKEN_KEY);
    return false;
  }
  activateUser(users[0]);
  return true;
}

async function fetchUser(token: string): Promise<SavedUser | null> {
  const response = await fetch("/api/user", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Failed to fetch user");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("name" in data) ||
    typeof data.name !== "string"
  ) {
    throw new Error("Invalid user response");
  }
  return { name: data.name, token };
}

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getActiveToken();
  if (token === null) throw new Error("Not authenticated");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && getActiveToken() === token) {
    forgetUser(token);
    window.location.replace("/login");
  }
  return response;
}

export {
  activateUser,
  authenticatedFetch,
  fetchUser,
  forgetUser,
  getActiveToken,
  getSavedUsers,
  logout,
  saveUser,
  type SavedUser,
};
