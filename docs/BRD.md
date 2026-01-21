# Business Requirements Document (BRD)
## Mangu Platform

| Document Version | Date       | Status |
| :--------------- | :--------- | :----- |
| 1.0              | 2026-01-21 | Draft  |

---

## 1. Executive Summary

**Mangu** is a "Netflix for Books" digital publishing platform designed to modernize the reading experience and democratize publishing. It connects readers, independent authors, and institutional partners through a seamless, high-performance web application.

The platform distinguishes itself through:
*   **"Resonance Engine"**: An AI-powered recommendation system using vector embeddings to match readers with books based on semantic similarity.
*   **Portals Architecture**: Dedicated interfaces for Authors (to manage manuscripts), Partners (to request ARCs/bulk orders), and Readers (to consume content).
*   **Direct-to-Consumer Model**: Streamlined purchasing and reading without the need for proprietary hardware.

---

## 2. Project Scope

### Phase 1: MVP (Launch Ready)
The initial release focuses on core marketplace functionality, secure transactions, and a robust reading experience.
*   **User Management**: Auth (Email/Password), Profile management, Roles (Reader, Author, Partner, Admin).
*   **Marketplace**: Book discovery, Search, Filtering, Detailed product pages.
*   **Reading Engine**: Browser-based e-reader with progress tracking and font customization.
*   **Author Portal**: Manuscript submission, metadata management, basic analytics.
*   **Monetization**: Individual book purchases via Stripe, Author payouts.
*   **Admin Dashboard**: Content moderation, User oversight, System health monitoring.

### Phase 2: Growth & Social (Planned)
*   **Social Features**: Reviews, Ratings, Shareable reading lists, Book Clubs.
*   **Advanced AI**: Personalized "For You" feeds, Content analysis for authors.
*   **Audiobooks**: Streaming audio support with playback syncing.
*   **Mobile Apps**: Native iOS/Android wrappers.
*   **Partner Portal Expansion**: Automated bulk licensing for libraries/universities.

---

## 3. User Personas

| Persona | Role | Key Goals | Pain Points |
| :--- | :--- | :--- | :--- |
| **The Enthusiast** | Reader | Discover niche books, read seamlessly across devices, track reading habits. | Overwhelmed by generic lists; hates "siloed" ecosystems (Kindle/Apple). |
| **The Indie Author** | Author | Publish easily, track earnings transparently, reach a targeted audience. | Gatekeepers in traditional publishing; complex formatting requirements. |
| **The Librarian** | Partner | Source high-quality content for institutions; manage ARC (Advanced Reader Copy) requests. | Manual licensing processes; lack of digital distribution for ARCs. |
| **The Curator** | Admin | Ensure platform quality, manage disputes, monitor revenue flow. | Managing spam/low-quality content; handling support tickets manually. |

---

## 4. Functional Requirements

### 4.1. Authentication & Profiles
*   **FR-AUTH-01**: Users must be able to sign up using Email/Password.
*   **FR-AUTH-02**: System must automatically create a public `Profile` entry upon account creation using a database trigger.
*   **FR-AUTH-03**: Users can request a password reset via email.
*   **FR-AUTH-04**: Role-based access control (RBAC) must restrict access to `/admin`, `/author`, and `/partner` routes.

### 4.2. Marketplace & Discovery
*   **FR-MKT-01**: The homepage must display "Featured", "Trending", and "New Arrivals" curated lists.
*   **FR-MKT-02**: Users can search books by Title, Author, or Keyword (using Full Text Search).
*   **FR-MKT-03**: Users can filter results by Genre, Price Range, and Rating.
*   **FR-MKT-04**: Book Detail pages must show Cover, Synopsis, Author Bio, Price, and "Read Sample" option.

### 4.3. Reading Experience
*   **FR-READ-01**: The e-reader must render EPUB content directly in the browser.
*   **FR-READ-02**: Reading progress (page/percentage) must sync to the database every 30 seconds or on page turn.
*   **FR-READ-03**: Users can customize font size, typeface, and theme (Light/Dark/Sepia).
*   **FR-READ-04**: Access is strictly gated: only purchased books or "Public" visibility books can be opened.

### 4.4. Author Portal
*   **FR-AUTH-01**: Authors can submit manuscripts with metadata (Title, Genre, Synopsis) and file uploads (PDF/EPUB).
*   **FR-AUTH-02**: Authors can view real-time sales data and royalty earnings.
*   **FR-AUTH-03**: Manuscript status tracking (Draft -> Submitted -> Under Review -> Published).

### 4.5. Admin Dashboard
*   **FR-ADM-01**: Admins can view and change the status of any book (e.g., Unpublish for violation).
*   **FR-ADM-02**: Global analytics dashboard showing DAU (Daily Active Users), MAU, and Gross Revenue.
*   **FR-ADM-03**: User management interface to ban/suspend users.

---

## 5. Data Logic & Architecture

### 5.1. Schema Overview
The database is normalized and hosted on **Supabase (PostgreSQL)**. Key entities include:

*   **`profiles`**: Extends Supabase Auth. Stores display name, bio, preferences.
*   **`books`**: Core product entity. Contains metadata, price, status.
*   **`book_content`**: Securely stores URLs to EPUB/PDF files (files stored in Storage Buckets).
*   **`reading_progress`**: Tracks `current_position` (0-100%) per user per book.
*   **`resonance_vectors`**: Stores 384-dimensional embeddings for AI similarity matching.
*   **`orders` & `order_items`**: Transactional records linked to Stripe Payment Intents.

### 5.2. The "Resonance Engine" (Data Logic)
*   **Vector Generation**: When a book is published, its Title, Description, and Genre are concatenated and passed to OpenAI's Embedding API (`text-embedding-3-small`).
*   **Storage**: The resulting vector is stored in `resonance_vectors`.
*   **Matching**: `get_similar_books` RPC function uses Cosine Similarity (`<=>` operator) to find nearest neighbors.
*   **Personalization**: `get_recommendations` RPC combines collaborative filtering (what others read) with content-based filtering (vectors) using a weighted score.

### 5.3. Security & RLS
*   **Row Level Security (RLS)** is enabled on all tables.
*   **Policy Example**: `reading_progress` can only be viewed/edited by the `user_id` that owns the record.
*   **Policy Example**: `books` with `status='published'` are readable by everyone; `status='draft'` are only readable by the author.

---

## 6. User Interface & Page Layouts

### 6.1. Sitemap Structure
```
/
├── (auth)              # Login, Register, Forgot Password
├── (consumer)          # Main Reader Experience
│   ├── /discover       # Browse, Search, Recommendations
│   ├── /books/[slug]   # Book Details & Purchase
│   ├── /reading/[id]   # E-Reader Interface
│   └── /library        # User's Purchased Books
├── (portals)
│   ├── /author         # Dashboard, Submit Manuscript, Earnings
│   └── /partner        # ARC Requests, Institutional Orders
└── /admin              # System Management
```

### 6.2. Key Layouts

**Book Detail Page (`app/(consumer)/books/[slug]/page.tsx`)**
*   **Hero Section**: Large blurred background of cover art. Foreground shows clean cover image, Title (H1), Author (Link).
*   **Action Bar**: "Buy Now ($9.99)" primary button, "Read Sample" secondary button. "Add to Wishlist" icon.
*   **Tabs**: Synopsis, Author Details, Reviews (Placeholder).
*   **Related Rows**: "You Might Also Like" horizontal scroll (powered by Resonance Engine).

**Reader Interface (`app/(consumer)/reading/[bookId]/page.tsx`)**
*   **Minimalist UI**: No header/footer navigation to reduce distractions.
*   **Controls**: Floating overlay (toggles on click) for Back, Table of Contents, and Settings (Aa).
*   **Progress Bar**: Bottom fixed bar showing % complete and Chapter name.

**Author Dashboard (`app/(portals)/author/dashboard/page.tsx`)**
*   **Stats Cards**: Total Sales, Royalties Pending, Books Published.
*   **Recent Activity**: Table of recent purchases of their books.
*   **Quick Actions**: "Submit New Manuscript", "Edit Profile".

---

## 7. Business Logic

### 7.1. Pricing & Revenue
*   **Standard Split**: Platform takes 30%, Author takes 70% of Net Revenue.
*   **Net Revenue**: `Price - (Stripe Fees + Tax)`.
*   **Payouts**: Calculated monthly via `author_payouts` table logic.

### 7.2. Access Control
*   **Purchased**: User has an entry in `order_items` for this `book_id`. Full access.
*   **Subscription**: User has active `subscription_tier='premium'`. Access to "Select" catalog.
*   **Public Domain**: Book `price` is 0. Access for all logged-in users.

---

## 8. Non-Functional Requirements

### 8.1. Performance
*   **Core Web Vitals**: LCP under 2.5s on mobile.
*   **Database**: Indexes on `status`, `genre`, `author_id`, and `published_at` to ensure sub-100ms query times for discovery.
*   **Caching**: `AnalyticsOptimizer` implements 5-minute in-memory caching for high-velocity read endpoints.

### 8.2. Security
*   **Environment**: Strict validation of `NEXT_PUBLIC_SUPABASE_URL`, `STRIPE_SECRET_KEY`, etc. at build time.
*   **Sanitization**: All user inputs (reviews, bios) sanitized to prevent XSS.
*   **Rate Limiting**: Applied to Auth routes and AI endpoints to prevent abuse.

---

## 9. Technical Stack

*   **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion.
*   **Backend**: Supabase (PostgreSQL 15), Supabase Auth, Supabase Storage.
*   **Payments**: Stripe (Connect & Checkout).
*   **AI**: OpenAI API (Embeddings).
*   **Testing**: Jest (Unit), Playwright (E2E).
*   **Deployment**: AWS Amplify / Vercel.

---
