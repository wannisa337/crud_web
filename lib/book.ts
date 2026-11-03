// กำหนดรูปแบบข้อมูลของหนังสือ
export interface Book {
  id: number;
  title: string;
  author: string;
  publishedYear: number;
  isAvailable: boolean;
  coverImage?: string | null;
}

// สร้างพื้นที่เก็บข้อมูลหนังสือจำลอง
const globalForBooks = globalThis as typeof globalThis & {
  booksStore?: Book[];
};

// ข้อมูลเริ่มต้น
export const books: Book[] = (globalForBooks.booksStore ??= [
  {
    id: 1,
    title: "Clean Code",
    author: "Robert C. Martin",
    publishedYear: 2008,
    isAvailable: true,
  },
  {
    id: 2,
    title: "Atomic Habits",
    author: "James Clear",
    publishedYear: 2018,
    isAvailable: true,
  },
  {
    id: 3,
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt",
    publishedYear: 1999,
    isAvailable: false,
  },
]);

// สร้าง ID ใหม่อัตโนมัติ
export function generateBookId(): number {
  if (books.length === 0) {
    return 1;
  }

  return Math.max(...books.map((book) => book.id)) + 1;
}