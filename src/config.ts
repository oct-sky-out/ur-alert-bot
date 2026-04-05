import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { SUPPORTED_DISCOUNT_SYSTEMS, type AppConfig } from "./types.js";

const targetSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  url: z.string().url(),
  enabled: z.boolean(),
});

const configSchema = z
  .object({
    timezone: z.literal("Asia/Tokyo"),
    scheduleTimes: z.tuple([
      z.literal("09:00"),
      z.literal("13:00"),
      z.literal("17:00"),
    ]),
    language: z.enum(["ko", "ja"]),
    priceMode: z.enum(["rent_only", "rent_plus_fee"]),
    maxPriceYen: z.number().int().nonnegative(),
    discountFilter: z
      .object({
        mode: z.enum(["ignore", "include", "exclude"]).default("ignore"),
        systems: z.array(z.enum(SUPPORTED_DISCOUNT_SYSTEMS)).default([]),
      })
      .default({
        mode: "ignore",
        systems: [],
      }),
    ntfy: z.object({
      serverUrl: z.string().url(),
      topic: z.string().trim().optional().default(""),
    }),
    targets: z.array(targetSchema).min(1).max(200),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();

    for (const target of value.targets) {
      if (ids.has(target.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate target id: ${target.id}`,
          path: ["targets"],
        });
      }

      ids.add(target.id);
    }
  });

export async function loadConfig(configPath = "config.json"): Promise<AppConfig> {
  const resolvedPath = path.resolve(configPath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const config = configSchema.parse(parsed) satisfies AppConfig;
  const envTopic = process.env.NTFY_TOPIC?.trim() ?? "";
  const topic = envTopic || config.ntfy.topic;

  if (!topic && process.env.NTFY_DRY_RUN !== "1") {
    throw new Error(
      "NTFY topic is missing. Set NTFY_TOPIC in the environment or define ntfy.topic in the config file.",
    );
  }

  return {
    ...config,
    ntfy: {
      ...config.ntfy,
      topic,
    },
  };
}
