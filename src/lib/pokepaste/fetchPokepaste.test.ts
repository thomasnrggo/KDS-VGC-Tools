import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPokepaste, isPokepasteUrl } from "./fetchPokepaste";

describe("isPokepasteUrl", () => {
  it("accepts a bare pokepast.es link", () => {
    expect(isPokepasteUrl("https://pokepast.es/71ea63846eaf71af")).toBe(true);
  });

  it("accepts a trailing slash and surrounding whitespace", () => {
    expect(isPokepasteUrl("  https://pokepast.es/71ea63846eaf71af/  ")).toBe(true);
  });

  it("accepts http and www", () => {
    expect(isPokepasteUrl("http://www.pokepast.es/71ea63846eaf71af")).toBe(true);
  });

  it("rejects a full Showdown export", () => {
    expect(isPokepasteUrl("Ditto @ Choice Scarf\nAbility: Imposter")).toBe(false);
  });

  it("rejects a pokepast.es link with extra text around it", () => {
    expect(isPokepasteUrl("check this out: https://pokepast.es/71ea63846eaf71af")).toBe(false);
  });

  it("rejects an unrelated URL", () => {
    expect(isPokepasteUrl("https://pokemonshowdown.com/71ea63846eaf71af")).toBe(false);
  });
});

describe("fetchPokepaste", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the paste text and title on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ paste: "Ditto @ Choice Scarf", title: "My Team" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPokepaste("https://pokepast.es/71ea63846eaf71af");

    expect(result).toEqual({ paste: "Ditto @ Choice Scarf", title: "My Team" });
    expect(fetchMock).toHaveBeenCalledWith("https://pokepast.es/71ea63846eaf71af/json");
  });

  it("defaults title to an empty string when missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ paste: "Ditto @ Choice Scarf" }),
      }),
    );

    const result = await fetchPokepaste("https://pokepast.es/71ea63846eaf71af");
    expect(result.title).toBe("");
  });

  it("throws for a non-Poképaste URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPokepaste("https://example.com/abc")).rejects.toThrow(
      "That doesn't look like a Poképaste link.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a friendly message on a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(fetchPokepaste("https://pokepast.es/doesnotexist")).rejects.toThrow(
      "doesn't exist",
    );
  });

  it("throws a friendly message on other non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(fetchPokepaste("https://pokepast.es/71ea63846eaf71af")).rejects.toThrow(
      "Couldn't load that Poképaste",
    );
  });

  it("throws a friendly message when the network request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(fetchPokepaste("https://pokepast.es/71ea63846eaf71af")).rejects.toThrow(
      "Couldn't reach Poképaste",
    );
  });

  it("throws when the response has no paste field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ title: "Empty" }) }),
    );

    await expect(fetchPokepaste("https://pokepast.es/71ea63846eaf71af")).rejects.toThrow(
      "doesn't contain a team export",
    );
  });
});
