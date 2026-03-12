"use server";

import { auth } from "@/lib/auth";

const IMGBB_API_URL = "https://api.imgbb.com/1/upload";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

export type ImgbbUploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

export async function uploadToImgbbAction(formData: FormData): Promise<ImgbbUploadResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Unauthorized" };
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.error("IMGBB_API_KEY is not configured");
    return { success: false, error: "Image upload service is not configured." };
  }

  const file = formData.get("image") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "No image file provided." };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP." };
  }

  if (file.size > MAX_SIZE) {
    return { success: false, error: "File is too large. Maximum size is 10 MB." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const body = new FormData();
    body.append("key", apiKey);
    body.append("image", base64);
    body.append("name", file.name.replace(/\.[^.]+$/, ""));

    const response = await fetch(IMGBB_API_URL, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      console.error("ImgBB API error:", response.status, response.statusText);
      return { success: false, error: "Failed to upload image. Please try again." };
    }

    const result = await response.json();

    if (!result.success) {
      return { success: false, error: "Image upload failed. Please try again." };
    }

    const url = result.data?.display_url || result.data?.url;
    if (!url || typeof url !== "string") {
      return { success: false, error: "Invalid response from image service." };
    }

    return { success: true, url };
  } catch (error) {
    console.error("ImgBB upload error:", error);
    return { success: false, error: "An unexpected error occurred during upload." };
  }
}
