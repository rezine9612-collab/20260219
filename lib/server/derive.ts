import { deriveRsl } from "./derive/rsl";
import { deriveCff } from "./derive/cff";
import { deriveRc } from "./derive/rc";
import { deriveRfs } from "./derive/rfs";

export type DeriveInput = any;

export function derive(input: DeriveInput): Record<string, any> {
  // Run in fixed order, then deep-merge results
  const a = deriveRsl(input);
  const b = deriveCff(input);
  const c = deriveRc({ ...input, ...b }); // allow rc to see cff if needed
  const d = deriveRfs({ ...input, ...b, ...a });

  return deepMergeAll(a, b, c, d);

  function deepMergeAll(...objs: any[]): any {
    const out: any = {};
    for (const o of objs) deepMergeInto(out, o);
    return out;
  }
  function deepMergeInto(target: any, src: any) {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const tv = target[k];
      if (tv && typeof tv === "object" && sv && typeof sv === "object" && !Array.isArray(tv) && !Array.isArray(sv)) {
        deepMergeInto(tv, sv);
      } else {
        target[k] = sv;
      }
    }
  }
}
