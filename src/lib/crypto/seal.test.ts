import { describe, expect, it } from "vitest";
import { seal, unseal } from "./seal";

const A = "a".repeat(43);
const B = "b".repeat(43);

describe("seal / unseal", () => {
    it("round-trips JSON", async () => {
        const token = await seal({ hello: "świat", n: [1, 2] }, A, "profile");
        expect(token.startsWith("v1.")).toBe(true);
        expect(await unseal(token, [A], "profile")).toEqual({ hello: "świat", n: [1, 2] });
    });

    it("never produces the same ciphertext twice", async () => {
        expect(await seal({ x: 1 }, A, "profile")).not.toBe(await seal({ x: 1 }, A, "profile"));
    });

    it("rejects a different purpose (no cookie swapping)", async () => {
        const token = await seal({ x: 1 }, A, "oauth");
        expect(await unseal(token, [A], "profile")).toBeNull();
    });

    it("rejects tampering", async () => {
        const token = await seal({ x: 1 }, A, "profile");
        const flipped = token.slice(0, -2) + (token.at(-2) === "A" ? "B" : "A") + token.at(-1);
        expect(await unseal(flipped, [A], "profile")).toBeNull();
        expect(await unseal("v1.garbage!!", [A], "profile")).toBeNull();
        expect(await unseal("", [A], "profile")).toBeNull();
        expect(await unseal(undefined, [A], "profile")).toBeNull();
    });

    it("supports key rotation (current, then previous)", async () => {
        const old = await seal({ x: 1 }, A, "profile");
        expect(await unseal(old, [B], "profile")).toBeNull();
        expect(await unseal(old, [B, A], "profile")).toEqual({ x: 1 });
    });
});
