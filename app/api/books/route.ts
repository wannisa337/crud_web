
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  mkdir,
  writeFile,
  unlink,
} from "node:fs/promises";

import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ======================================
// GET /api/books
// ดึงข้อมูลหนังสือทั้งหมดจาก Database
// ======================================

export async function GET() {
  try {
    // ดึงข้อมูลหนังสือทั้งหมดจาก SQLite
    const books = await prisma.book.findMany({
      orderBy: {
        id: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Get all books successfully",
      data: books,
    });

  } catch (error) {
    console.error("Get books error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get books",
      },
      { status: 500 }
    );
  }
}

// ======================================
// POST /api/books
// เพิ่มหนังสือใหม่พร้อมรูปหน้าปก
// ======================================

export async function POST(request: Request) {
  let savedFilePath: string | null = null;

  try {
    // 1. รับข้อมูลแบบ FormData
    const formData = await request.formData();

    // 2. ดึงข้อมูลจาก FormData
    const title = formData.get("title");
    const author = formData.get("author");
    const publishedYear = Number(formData.get("publishedYear"));
    const isAvailable = formData.get("isAvailable");
    const coverImage = formData.get("coverImage");

    // 3. ตรวจสอบข้อมูลหนังสือ
    if (
      typeof title !== "string" ||
      title.trim() === "" ||
      typeof author !== "string" ||
      author.trim() === "" ||
      !Number.isInteger(publishedYear) ||
      publishedYear <= 0 ||
      (isAvailable !== "true" && isAvailable !== "false")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid book data",
        },
        { status: 400 }
      );
    }

    // 4. เตรียม URL รูปภาพ
    let coverImageUrl: string | null = null;

    // 5. ตรวจสอบว่ามีการอัปโหลดรูปภาพหรือไม่
    if (coverImage !== null) {
      // ตรวจสอบว่าเป็น File จริง
      if (!(coverImage instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid image file",
          },
          { status: 400 }
        );
      }

      // ชนิดไฟล์ที่อนุญาต
      const allowedTypes: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const extension = allowedTypes[coverImage.type];

      if (!extension) {
        return NextResponse.json(
          {
            success: false,
            message: "Only JPG, PNG and WEBP images are allowed",
          },
          { status: 400 }
        );
      }

      // จำกัดขนาดไฟล์ไม่เกิน 5 MB
      const MAX_FILE_SIZE = 5 * 1024 * 1024;

      if (coverImage.size === 0 || coverImage.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: "Image size must be between 1 byte and 5 MB",
          },
          { status: 400 }
        );
      }

      // 6. สร้างชื่อไฟล์แบบสุ่ม
      const fileName = `${randomUUID()}.${extension}`;

      // กำหนดโฟลเดอร์เก็บรูปภาพ
      const uploadDir = join(process.cwd(), "public", "uploads");

      // สร้างโฟลเดอร์ถ้ายังไม่มี
      await mkdir(uploadDir, { recursive: true });

      // แปลง File เป็น Buffer
      const buffer = Buffer.from(
        await coverImage.arrayBuffer()
      );

      // บันทึกไฟล์รูปภาพ
      savedFilePath = join(uploadDir, fileName);

      await writeFile(savedFilePath, buffer);

      // สร้าง URL สำหรับแสดงรูปภาพ
      coverImageUrl = `/uploads/${fileName}`;
    }

    // 7. เพิ่มข้อมูลหนังสือลง Database
    const newBook = await prisma.book.create({
      data: {
        title: title.trim(),
        author: author.trim(),
        publishedYear,
        isAvailable: isAvailable === "true",
        coverImage: coverImageUrl,
      },
    });

    // 8. ส่งข้อมูลกลับไปยัง Frontend
    return NextResponse.json(
      {
        success: true,
        message: "Book created successfully",
        data: newBook,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Create book error:", error);

    // หากบันทึก Database ไม่สำเร็จ
    // ให้ลบไฟล์รูปภาพที่เพิ่งอัปโหลดไปด้วย
    if (savedFilePath) {
      try {
        await unlink(savedFilePath);
      } catch (fileError) {
        console.error("Delete uploaded image error:", fileError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create book",
      },
      { status: 500 }
    );
  }
}
