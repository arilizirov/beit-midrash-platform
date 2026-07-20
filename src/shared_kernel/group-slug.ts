/**
 * The slug of the single Group this deployment serves (SPEC §4 V1
 * invariant). ONE definition, shared by the seed job and the runtime guard —
 * if they disagreed, every protected page would 500 while the seed looked
 * fine. Read at CALL time, never captured at module load, because
 * `process.loadEnvFile()` may run after import.
 */
export const DEFAULT_GROUP_SLUG = "beit-midrash";

export function seedGroupSlug(): string {
  return process.env.SEED_GROUP_SLUG ?? DEFAULT_GROUP_SLUG;
}
