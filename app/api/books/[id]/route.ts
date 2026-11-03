
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ======================================
// กำหนดรูปแบบของ Parameters
// ======================================

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ======================================
// ฟังก์ชันตรวจสอบ ID
// ======================================

function isValidBookId(id: number) {
  return Number.isInteger(id) && id > 0;
}

// ======================================
// ฟังก์ชันบันทึกรูปภาพ
// ======================================

async function saveCoverImage(file: File): Promise<string> {

  // ตรวจสอบประเภทไฟล์
  const allowedTypes: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = allowedTypes[file.type];

  if (!extension) {
    throw new Error("Only JPG, PNG and WEBP images are allowed");
  }

  // ตรวจสอบขนาดไฟล์ไม่เกิน 5 MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Image size must be between 1 byte and 5 MB");
  }

  // สร้างชื่อไฟล์แบบสุ่ม
  const fileName = `${randomUUID()}.${extension}`;

  // กำหนดตำแหน่งจัดเก็บรูปภาพ
  const uploadDir = join(process.cwd(), "public", "uploads");

  // สร้างโฟลเดอร์หากยังไม่มี
  await mkdir(uploadDir, { recursive: true });

  // แปลงไฟล์เป็น Buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // บันทึกไฟล์
  await writeFile(join(uploadDir, fileName), buffer);

  // ส่ง URL กลับ
  return `/uploads/${fileName}`;
}

// ======================================
// ฟังก์ชันลบไฟล์รูปภาพ
// ======================================

async function deleteCoverImage(imageUrl?: string | null) {

  if (!imageUrl) {
    return;
  }

  // ป้องกันการลบไฟล์ที่ไม่ได้อยู่ใน uploads
  const fileName = imageUrl.split("/").pop();

  if (!fileName || !/^[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(fileName)) {
    return;
  }

  const filePath = join(
    process.cwd(),
    "public",
    "uploads",
    fileName
  );

  try {
    await unlink(filePath);
  } catch (error) {

    // หากไม่พบไฟล์ ไม่จำเป็นต้องหยุดการทำงาน
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

// ======================================
// GET /api/books/:id
// ดึงข้อมูลหนังสือเพียงเล่มเดียว
// ======================================

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    // 1. รับ ID จาก URL
    const { id } = await params;

    // 2. แปลง ID จาก String เป็น Number
    const bookId = Number(id);

    // 3. ตรวจสอบ ID
    if (!isValidBookId(bookId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid book ID",
        },
        { status: 400 }
      );
    }

    // 4. ค้นหาหนังสือจาก Database
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
    });

    // 5. ตรวจสอบว่าพบหนังสือหรือไม่
    if (!book) {
      return NextResponse.json(
        {
          success: false,
          message: "Book not found",
        },
        { status: 404 }
      );
    }

    // 6. ส่งข้อมูลกลับ
    return NextResponse.json({
      success: true,
      message: "Get book successfully",
      data: book,
    });

  } catch (error) {
    console.error("Get book error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get book",
      },
      { status: 500 }
    );
  }
}

// ======================================
// PUT /api/books/:id
// แก้ไขข้อมูลหนังสือและรูปหน้าปก
// ======================================

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  let newCoverImageUrl: string | null = null;

  try {
    // 1. รับ ID จาก URL
    const { id } = await params;
    const bookId = Number(id);

    // 2. ตรวจสอบ ID
    if (!isValidBookId(bookId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid book ID",
        },
        { status: 400 }
      );
    }

    // 3. ค้นหาหนังสือเดิมจาก Database
    const existingBook = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
    });

    // 4. ตรวจสอบว่าพบหนังสือหรือไม่
    if (!existingBook) {
      return NextResponse.json(
        {
          success: false,
          message: "Book not found",
        },
        { status: 404 }
      );
    }

    // 5. รับข้อมูลแบบ FormData
    const formData = await request.formData();

    const title = formData.get("title");
    const author = formData.get("author");
    const publishedYear = Number(formData.get("publishedYear"));
    const isAvailable = formData.get("isAvailable");
    const coverImage = formData.get("coverImage");

    // 6. ตรวจสอบข้อมูลใหม่
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

    // 7. กำหนดรูปภาพเดิมเป็นค่าเริ่มต้น
    let coverImageUrl = existingBook.coverImage;

    // ตรวจสอบว่าผู้ใช้เลือกรูปใหม่หรือไม่
    if (coverImage !== null) {

      if (!(coverImage instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid image file",
          },
          { status: 400 }
        );
      }

      // บันทึกรูปภาพใหม่
      newCoverImageUrl = await saveCoverImage(coverImage);

      coverImageUrl = newCoverImageUrl;
    }

    // 8. อัปเดตข้อมูลใน Database
    const updatedBook = await prisma.book.update({
      where: {
        id: bookId,
      },
      data: {
        title: title.trim(),
        author: author.trim(),
        publishedYear,
        isAvailable: isAvailable === "true",
        coverImage: coverImageUrl,
      },
    });

    // 9. หากมีรูปใหม่ ให้ลบรูปเก่าหลังจากบันทึกสำเร็จ
    if (newCoverImageUrl && existingBook.coverImage) {
      try {
        await deleteCoverImage(existingBook.coverImage);
      } catch (error) {
        console.error("Failed to delete old cover:", error);
      }
    }

    // 10. ส่งข้อมูลกลับ
    return NextResponse.json({
      success: true,
      message: "Book updated successfully",
      data: updatedBook,
    });

  } catch (error) {

    console.error("Update book error:", error);

    // หากเกิดข้อผิดพลาด ให้ลบรูปใหม่ที่อัปโหลดไว้
    // เพื่อไม่ให้มีไฟล์ที่ไม่ได้ถูกใช้งานเหลืออยู่
    if (newCoverImageUrl) {
      try {
        await deleteCoverImage(newCoverImageUrl);
      } catch (fileError) {
        console.error("Failed to delete new cover:", fileError);
      }
    }

    const isValidationError =
      error instanceof Error &&
      (
        error.message.includes("Only JPG") ||
        error.message.includes("Image size")
      );

    return NextResponse.json(
      {
        success: false,
        message: isValidationError
          ? error.message
          : "Failed to update book",
      },
      {
        status: isValidationError ? 400 : 500,
      }
    );
  }
}

// ======================================
// DELETE /api/books/:id
// ลบหนังสือและรูปหน้าปก
// ======================================

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    // 1. รับ ID จาก URL
    const { id } = await params;
    const bookId = Number(id);

    // 2. ตรวจสอบ ID
    if (!isValidBookId(bookId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid book ID",
        },
        { status: 400 }
      );
    }

    // 3. ค้นหาหนังสือจาก Database
    const existingBook = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
    });

    // 4. ตรวจสอบว่าพบหนังสือหรือไม่
    if (!existingBook) {
      return NextResponse.json(
        {
          success: false,
          message: "Book not found",
        },
        { status: 404 }
      );
    }

    // 5. ลบหนังสือออกจาก Database
    const deletedBook = await prisma.book.delete({
      where: {
        id: bookId,
      },
    });

    // 6. ลบไฟล์รูปหน้าปก
    try {
      await deleteCoverImage(deletedBook.coverImage);
    } catch (error) {
      console.error("Failed to delete book cover:", error);
    }

    // 7. ส่งผลลัพธ์กลับ
    return NextResponse.json({
      success: true,
      message: "Book deleted successfully",
      data: deletedBook,
    });

  } catch (error) {
    console.error("Delete book error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete book",
      },
      { status: 500 }
    );
  }
}
