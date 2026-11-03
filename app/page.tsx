
"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

// ======================================
// 1. กำหนดรูปแบบข้อมูลหนังสือ
// ======================================

interface Book {
  id: number;
  title: string;
  author: string;
  publishedYear: number;
  isAvailable: boolean;

  // URL ของรูปหน้าปกหนังสือ
  coverImage?: string | null;
}

// กำหนดรูปแบบข้อมูลใน Form
interface BookForm {
  title: string;
  author: string;
  publishedYear: string;
  isAvailable: boolean;
}

// ค่าเริ่มต้นของ Form
const initialForm: BookForm = {
  title: "",
  author: "",
  publishedYear: "",
  isAvailable: true,
};

// ======================================
// 2. Main Component
// ======================================

export default function Home() {

  // เก็บรายการหนังสือ
  const [books, setBooks] = useState<Book[]>([]);

  // เก็บข้อมูลที่ผู้ใช้กรอกใน Form
  const [form, setForm] = useState<BookForm>(initialForm);

  // เก็บ ID ของหนังสือที่กำลังแก้ไข
  const [editingId, setEditingId] = useState<number | null>(null);

  // สถานะการโหลดข้อมูล
  const [isLoading, setIsLoading] = useState(false);

  // สถานะการบันทึกข้อมูล
  const [isSubmitting, setIsSubmitting] = useState(false);

  // เก็บข้อความ Error
  const [error, setError] = useState("");

  // เก็บคำค้นหา
  const [searchTerm, setSearchTerm] = useState("");

  // ======================================
  // 3. จัดการรูปหน้าปกหนังสือ
  // ======================================

  // เก็บไฟล์รูปภาพที่เลือก
  const [image, setImage] = useState<File | null>(null);

  // เก็บ URL สำหรับแสดง Preview
  const [preview, setPreview] = useState<string | null>(null);

  // อ้างอิงถึง Input สำหรับเลือกรูปภาพ
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ล้าง URL ชั่วคราวเมื่อเปลี่ยนรูปหรือออกจากหน้า
  useEffect(() => {

    if (!preview || !preview.startsWith("blob:")) {
      return;
    }

    return () => {
      URL.revokeObjectURL(preview);
    };

  }, [preview]);


  // ฟังก์ชันเลือกรูปภาพ
  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // ตรวจสอบประเภทไฟล์
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    // จำกัดขนาดไฟล์ไม่เกิน 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");

    // เก็บไฟล์รูปภาพ
    setImage(file);

    // สร้าง URL สำหรับแสดง Preview
    const imageUrl = URL.createObjectURL(file);

    setPreview(imageUrl);

  };


  // ลบรูปภาพที่เลือก
  const handleRemoveImage = () => {

    setImage(null);
    setPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

  };


  // รีเซ็ต Form และรูปภาพ
  const resetForm = () => {

    setForm(initialForm);
    setEditingId(null);
    setImage(null);
    setPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

  };


  // ======================================
  // 4. READ - ดึงข้อมูลหนังสือทั้งหมด
  // ======================================

  const fetchBooks = useCallback(async () => {

    setIsLoading(true);
    setError("");

    try {

      const response = await fetch("/api/books");

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch books");
      }

      setBooks(result.data);

    } catch (err: unknown) {

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }

    } finally {

      setIsLoading(false);

    }

  }, []);


  // โหลดข้อมูลเมื่อเปิดหน้าเว็บไซต์ครั้งแรก
  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);


  // ======================================
  // 5. CREATE และ UPDATE
  // ======================================

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {

    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {

      // ตรวจสอบข้อมูลก่อนส่ง
      const publishedYear = Number(form.publishedYear);

      if (
        !Number.isInteger(publishedYear) ||
        publishedYear <= 0
      ) {
        throw new Error("Please enter a valid published year.");
      }

      // สร้าง FormData สำหรับส่งข้อมูลและไฟล์รูปภาพ
      const bookData = new FormData();

      bookData.append("title", form.title.trim());
      bookData.append("author", form.author.trim());
      bookData.append("publishedYear", String(publishedYear));
      bookData.append("isAvailable", String(form.isAvailable));

      // ถ้ามีการเลือกรูปภาพ ให้เพิ่มไฟล์ลงใน FormData
      if (image) {
        bookData.append("coverImage", image);
      }

      // ตรวจสอบว่าเป็นการเพิ่มหรือแก้ไข
      const isEditing = editingId !== null;

      // กำหนด URL
      const url = isEditing
        ? `/api/books/${editingId}`
        : "/api/books";

      // กำหนด HTTP Method
      const method = isEditing ? "PUT" : "POST";

      // ส่งข้อมูลไปยัง Backend
      const response = await fetch(url, {
        method,
        body: bookData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to save book");
      }

      // ล้าง Form
      resetForm();

      // โหลดข้อมูลหนังสือใหม่
      await fetchBooks();

    } catch (err: unknown) {

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }

    } finally {

      setIsSubmitting(false);

    }

  };


  // ======================================
  // 6. UPDATE - เลือกหนังสือมาแก้ไข
  // ======================================

  const handleEdit = (book: Book) => {

    // นำข้อมูลหนังสือมาใส่ใน Form
    setForm({
      title: book.title,
      author: book.author,
      publishedYear: String(book.publishedYear),
      isAvailable: book.isAvailable,
    });

    // บันทึก ID ที่กำลังแก้ไข
    setEditingId(book.id);

    // นำรูปเดิมมาแสดงใน Preview
    setImage(null);
    setPreview(book.coverImage || null);

    // รีเซ็ต Input File
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // ล้าง Error
    setError("");

    // เลื่อนหน้าจอขึ้นไปยัง Form
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  };


  // ======================================
  // 7. DELETE - ลบหนังสือ
  // ======================================

  const handleDelete = async (id: number) => {

    const confirmed = window.confirm(
      "Are you sure you want to delete this book?"
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {

      const response = await fetch(`/api/books/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete book");
      }

      // ถ้ากำลังแก้ไขหนังสือเล่มที่ถูกลบ ให้ล้าง Form
      if (editingId === id) {
        resetForm();
      }

      await fetchBooks();

    } catch (err: unknown) {

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }

    }

  };


  // ======================================
  // 8. CANCEL - ยกเลิกการแก้ไข
  // ======================================

  const handleCancel = () => {

    resetForm();
    setError("");

  };


  // ======================================
  // 9. SEARCH - ค้นหาหนังสือ
  // ======================================

  const filteredBooks = books.filter((book) => {

    const keyword = searchTerm.toLowerCase();

    return (
      book.title.toLowerCase().includes(keyword) ||
      book.author.toLowerCase().includes(keyword)
    );

  });


  // ======================================
  // 10. FRONTEND UI
  // ======================================

  return (

    <main className="container">

      {/* Header */}
      <header className="header">

        <div>
          <h1>Library Management</h1>
          <p>Manage your library books</p>
        </div>

        <div className="book-count">
          {books.length} Books
        </div>

      </header>


      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      {/* Book Form */}
      <section className="form-section">

        <h2>
          {editingId !== null ? "Edit Book" : "Add New Book"}
        </h2>

        <form onSubmit={handleSubmit}>

          {/* Title */}
          <div className="form-group">

            <label htmlFor="title">
              Book Title
            </label>

            <input
              id="title"
              type="text"
              placeholder="Enter book title"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              required
            />

          </div>


          {/* Author */}
          <div className="form-group">

            <label htmlFor="author">
              Author
            </label>

            <input
              id="author"
              type="text"
              placeholder="Enter author name"
              value={form.author}
              onChange={(e) =>
                setForm({
                  ...form,
                  author: e.target.value,
                })
              }
              required
            />

          </div>


          {/* Published Year */}
          <div className="form-group">

            <label htmlFor="publishedYear">
              Published Year
            </label>

            <input
              id="publishedYear"
              type="number"
              placeholder="Enter published year"
              value={form.publishedYear}
              onChange={(e) =>
                setForm({
                  ...form,
                  publishedYear: e.target.value,
                })
              }
              required
            />

          </div>


          {/* Book Cover Upload */}
          <div className="form-group">

            <label htmlFor="coverImage">
              Book Cover
            </label>

            <div className="cover-upload">

              <input
                ref={fileInputRef}
                id="coverImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
              />

              <p>
                Supported formats: JPG, PNG, WEBP (Max 5 MB)
              </p>

              {/* Preview */}
              {preview && (

                <div className="cover-preview">

                  <img
                    src={preview}
                    alt="Book Cover Preview"
                  />

                </div>

              )}

              {/* Remove Image */}
              {preview && (

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRemoveImage}
                >
                  Remove Image
                </button>

              )}

            </div>

          </div>


          {/* Availability */}
          <div className="form-group checkbox-group">

            <input
              id="isAvailable"
              type="checkbox"
              checked={form.isAvailable}
              onChange={(e) =>
                setForm({
                  ...form,
                  isAvailable: e.target.checked,
                })
              }
            />

            <label htmlFor="isAvailable">
              Available for borrowing
            </label>

          </div>


          {/* Buttons */}
          <div className="form-buttons">

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : editingId !== null
                  ? "Update Book"
                  : "Add Book"}
            </button>

            {editingId !== null && (

              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>

            )}

          </div>

        </form>

      </section>


      {/* Book List */}
      <section className="list-section">

        <div className="list-header">

          <h2>Book List</h2>

          <input
            className="search-input"
            type="text"
            placeholder="Search title or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

        </div>


        {/* Loading */}
        {isLoading && (

          <p className="loading">
            Loading books...
          </p>

        )}


        {/* Empty List */}
        {!isLoading && filteredBooks.length === 0 && (

          <p className="empty-message">
            No books found.
          </p>

        )}


        {/* Display Books */}
        {!isLoading && filteredBooks.length > 0 && (

          <div className="book-list">

            {filteredBooks.map((book) => (

              <div className="book-card" key={book.id}>

                {/* Book Content */}
                <div className="book-content">

                  {/* Book Cover */}
                  <div className="book-cover">

                    {book.coverImage ? (

                      <img
                        src={book.coverImage}
                        alt={`${book.title} cover`}
                      />

                    ) : (

                      <div className="no-cover">
                        No Cover
                      </div>

                    )}

                  </div>


                  {/* Book Information */}
                  <div className="book-info">

                    <h3>{book.title}</h3>

                    <p>Author: {book.author}</p>

                    <p>Published Year: {book.publishedYear}</p>

                    <p>Book ID: {book.id}</p>

                    <span
                      className={
                        book.isAvailable
                          ? "status available"
                          : "status borrowed"
                      }
                    >
                      {book.isAvailable
                        ? "Available"
                        : "Borrowed"}
                    </span>

                  </div>

                </div>


                {/* Edit and Delete Buttons */}
                <div className="book-actions">

                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(book)}
                  >
                    Edit
                  </button>

                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(book.id)}
                  >
                    Delete
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>

    </main>

  );

}
