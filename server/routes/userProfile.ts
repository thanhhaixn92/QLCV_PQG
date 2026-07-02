import type express from "express";

export interface UserProfileRouteDeps {
  getUserIdFromRequest: (
    req: express.Request,
    res?: express.Response,
  ) => Promise<string | null>;
  getUserTokenFromRequest: (req: express.Request) => Promise<any | null>;
  getEffectiveUserRole: (token: any) => "admin" | "user";
  adminAuth: any;
  db: any;
  isFirestoreReady: () => boolean;
  ensureFirestoreReady: (res: express.Response) => boolean;
  classifyFirestoreError: (error: any) => {
    errorType: string;
    message: string;
  };
  logFirestoreError: (context: string, error: any) => void;
}

export function buildOfflineProfile(token: any, role: "admin" | "user") {
  return {
    uid: token.uid,
    email: token.email || "",
    displayName: token.name || "Người dùng Offline",
    photoURL: token.picture || "",
    role,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function buildProfilePatch(body: any, userId: string, timestamp: number) {
  return {
    displayName: String(body?.displayName || "").trim(),
    title: String(body?.title || "").trim(),
    department: String(body?.department || "").trim(),
    phone: String(body?.phone || "").trim(),
    avatarText: String(body?.avatarText || "").trim(),
    defaultAssigneeName: String(body?.defaultAssigneeName || "").trim(),
    defaultTaskCategoryCode: String(
      body?.defaultTaskCategoryCode || "LV_DH",
    ).trim(),
    ownerId: userId,
    updatedAt: timestamp,
  };
}

export function registerUserProfileRoutes(
  app: express.Application,
  deps: UserProfileRouteDeps,
) {
  app.get("/api/user/profile", async (req, res) => {
    try {
      const userId = await deps.getUserIdFromRequest(req, res);
      if (userId === "AUTH_AUDIENCE_MISMATCH" || userId === "AUTH_ERROR") {
        return;
      }
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "unauthorized",
          errorType: "unauthorized",
          message: "Vui lòng đăng nhập.",
        });
      }

      const token = await deps.getUserTokenFromRequest(req);
      if (!token) return;

      const effectiveRole = deps.getEffectiveUserRole(token);

      if (effectiveRole === "admin" && token.role !== "admin") {
        if (deps.adminAuth) {
          await deps.adminAuth.setCustomUserClaims(token.uid, { role: "admin" });
        }
      }

      if (!deps.isFirestoreReady()) {
        return res.json({
          success: true,
          profile: buildOfflineProfile(token, effectiveRole),
        });
      }

      const profileSnap = await deps.db
        .collection("users")
        .doc(token.uid)
        .collection("profile")
        .doc("main")
        .get();

      if (profileSnap.exists) {
        return res.json({
          success: true,
          profile: {
            ...profileSnap.data(),
            uid: token.uid,
            email: token.email || "",
            role: effectiveRole,
          },
        });
      }

      const baseProfile = {
        uid: token.uid,
        email: token.email || "",
        displayName: token.name || "",
        photoURL: token.picture || "",
        role: effectiveRole,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await deps.db
        .collection("users")
        .doc(token.uid)
        .collection("profile")
        .doc("main")
        .set(baseProfile);

      return res.json({
        success: true,
        profile: baseProfile,
      });
    } catch (error: any) {
      const classified = deps.classifyFirestoreError(error);
      deps.logFirestoreError("api/user/profile", error);

      return res.status(500).json({
        success: false,
        errorType: classified.errorType || "profile_get_failed",
        message: classified.message || "Không thể lấy thông tin hồ sơ.",
      });
    }
  });

  app.post("/api/user/profile", async (req, res) => {
    try {
      const userId = await deps.getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          errorType: "unauthorized",
          message: "Vui lòng đăng nhập để lưu hồ sơ.",
        });
      }

      if (!deps.ensureFirestoreReady(res)) return;

      const profileData = buildProfilePatch(req.body, userId, Date.now());

      await deps.db
        .collection("users")
        .doc(userId)
        .collection("profile")
        .doc("main")
        .set(profileData, { merge: true });

      return res.json({
        success: true,
        profile: profileData,
      });
    } catch (error: any) {
      const classified = deps.classifyFirestoreError(error);
      console.error("[Firestore Error - POST /api/user/profile]", {
        errorType: classified.errorType,
        message: classified.message,
      });

      return res.status(500).json({
        success: false,
        errorType: classified.errorType || "profile_save_failed",
        message: classified.message || "Không thể lưu thông tin hồ sơ.",
      });
    }
  });
}
