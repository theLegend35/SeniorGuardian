import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHUNK = 1800;

const secureStorage = {
  async getItem(key: string) {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (!countRaw) return SecureStore.getItemAsync(key);
    const count = Number(countRaw);
    let value = "";
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${index}`);
      if (part == null) return null;
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK);
    await SecureStore.setItemAsync(`${key}.n`, String(count));
    for (let index = 0; index < count; index += 1) {
      await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
    }
  },
  async removeItem(key: string) {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (countRaw) {
      const count = Number(countRaw);
      for (let index = 0; index < count; index += 1) await SecureStore.deleteItemAsync(`${key}.${index}`);
      await SecureStore.deleteItemAsync(`${key}.n`);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

const memory = new Map<string, string>();
const webStorage = {
  getItem: async (key: string) => memory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    memory.delete(key);
  },
};

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseReady = Boolean(supabaseUrl && supabaseKey);
export const webUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(/\/$/, "");

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseKey || "public-anon-key", {
  auth: {
    storage: Platform.OS === "web" ? webStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
