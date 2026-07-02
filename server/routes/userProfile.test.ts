import { describe, expect, it, vi } from "vitest";
import { buildOfflineProfile, buildProfilePatch } from "./userProfile";

describe("user profile route helpers", () => {
  it("builds degraded offline profile from token", () => {
    vi.setSystemTime(new Date("2026-07-02T00:00:00Z"));
    const profile = buildOfflineProfile(
      { uid: "u1", email: "a@example.com", name: "", picture: "" },
      "user",
    );

    expect(profile).toMatchObject({
      uid: "u1",
      email: "a@example.com",
      displayName: "Người dùng Offline",
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    vi.useRealTimers();
  });

  it("trims profile patch fields and defaults task category", () => {
    expect(
      buildProfilePatch(
        {
          displayName: "  Nguyễn Văn A  ",
          title: "  Điều độ  ",
          defaultTaskCategoryCode: "",
        },
        "u1",
        123,
      ),
    ).toMatchObject({
      displayName: "Nguyễn Văn A",
      title: "Điều độ",
      defaultTaskCategoryCode: "LV_DH",
      ownerId: "u1",
      updatedAt: 123,
    });
  });
});
