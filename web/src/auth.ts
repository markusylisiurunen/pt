import { DEFAULT_THEME_HUE, isThemeHue } from "./theme";

interface SavedUser {
  name: string;
  token: string;
  themeHue: number;
}

const USERS_KEY = "users";
const TOKEN_KEY = "token";
const pageToken = window.localStorage.getItem(TOKEN_KEY);

function getActiveToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

function getPageToken(): string | null {
  return pageToken;
}

function parseSavedUser(value: unknown): SavedUser | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    !("token" in value) ||
    typeof value.token !== "string" ||
    value.token.length === 0
  ) {
    return null;
  }

  const themeHue = "themeHue" in value ? value.themeHue : DEFAULT_THEME_HUE;
  if (!isThemeHue(themeHue)) return null;
  return { name: value.name, token: value.token, themeHue };
}

function getSavedUsers(): SavedUser[] {
  const value = window.localStorage.getItem(USERS_KEY);
  if (value === null) return [];

  let users: unknown;
  try {
    users = JSON.parse(value);
  } catch {
    window.localStorage.removeItem(USERS_KEY);
    return [];
  }
  if (!Array.isArray(users)) {
    window.localStorage.removeItem(USERS_KEY);
    return [];
  }

  const savedUsers: SavedUser[] = [];
  for (const value of users) {
    const user = parseSavedUser(value);
    if (user === null) {
      window.localStorage.removeItem(USERS_KEY);
      return [];
    }
    savedUsers.push(user);
  }
  return savedUsers;
}

function setSavedUsers(users: SavedUser[]): void {
  if (users.length === 0) {
    window.localStorage.removeItem(USERS_KEY);
  } else {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

function rememberUser(user: SavedUser): void {
  const users = getSavedUsers();
  const matches = (savedUser: SavedUser) =>
    savedUser.name === user.name || savedUser.token === user.token;
  const index = users.findIndex(matches);
  const nextUsers = users.filter((savedUser) => !matches(savedUser));
  nextUsers.splice(index === -1 ? nextUsers.length : index, 0, user);
  setSavedUsers(nextUsers);
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
  const token = getPageToken();
  const activeToken = getActiveToken();
  if (token === null || activeToken !== token) return activeToken !== null;

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
    typeof data.name !== "string" ||
    data.name.length === 0 ||
    !("themeHue" in data) ||
    !isThemeHue(data.themeHue)
  ) {
    throw new Error("Invalid user response");
  }
  return { name: data.name, token, themeHue: data.themeHue };
}

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (pageToken === null) throw new Error("Not authenticated");

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${pageToken}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && getActiveToken() === pageToken) {
    forgetUser(pageToken);
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
  getPageToken,
  getSavedUsers,
  logout,
  rememberUser,
  type SavedUser,
};
