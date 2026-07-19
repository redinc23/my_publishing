# Query Recipes

## getBooks

Aggregate: match filters → `$lookup` authors → sort → facet/skip/limit (default 20).

## getBookBySlug

`findOne({ slug, status: appropriate })` + author join as needed.

## searchBooks

`$text: { $search }` → project `score: { $meta: "textScore" }` → sort by score.
Sanitize user input before building queries (especially any legacy string filters).

## Rating recompute

After review insert:

1. Aggregate avg + count for `book_id`
2. `books.updateOne({ _id }, { $set: { avg_rating, review_count } })`
3. `revalidatePath` for book pages
