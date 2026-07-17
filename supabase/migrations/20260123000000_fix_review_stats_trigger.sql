-- Hotfix: review stats functions on the live DB used a parameter named "book_id",
-- which is ambiguous with the reviews.book_id column (error 42702) and broke every
-- INSERT/UPDATE/DELETE on reviews via the update_book_stats_on_review trigger.
-- This re-creates the functions with unambiguous parameter names.

CREATE OR REPLACE FUNCTION get_book_average_rating(target_book_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    avg_rating DECIMAL(3,2);
BEGIN
    SELECT AVG(rating)::DECIMAL(3,2)
    INTO avg_rating
    FROM reviews
    WHERE reviews.book_id = target_book_id AND reviews.is_public = true;

    RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_book_review_count(target_book_id UUID)
RETURNS INTEGER AS $$
DECLARE
    review_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO review_count
    FROM reviews
    WHERE reviews.book_id = target_book_id AND reviews.is_public = true;

    RETURN COALESCE(review_count, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_book_review_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_id := OLD.book_id;
    ELSE
        target_id := NEW.book_id;
    END IF;

    UPDATE books
    SET
        average_rating = get_book_average_rating(target_id),
        review_count = get_book_review_count(target_id),
        total_reviews = get_book_review_count(target_id)
    WHERE id = target_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_book_stats_on_review ON reviews;
CREATE TRIGGER update_book_stats_on_review
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_book_review_stats();
