from playwright.sync_api import sync_playwright

def verify_pages():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Verify Discover Page
        try:
            page.goto("http://localhost:3000/discover", timeout=60000)
            page.wait_for_selector("h1:has-text('Discover')")
            page.screenshot(path="verification/discover.png")
            print("Discover page screenshot taken.")
        except Exception as e:
            print(f"Discover page failed: {e}")

        # Verify Readers Hub
        try:
            page.goto("http://localhost:3000/readers-hub", timeout=60000)
            # It might redirect to login because it is protected
            if "/login" in page.url:
                print("Redirected to login as expected for Readers Hub")
                page.screenshot(path="verification/readers_hub_login.png")
            else:
                page.screenshot(path="verification/readers_hub.png")
                print("Readers Hub screenshot taken.")
        except Exception as e:
            print(f"Readers Hub failed: {e}")

        browser.close()

if __name__ == "__main__":
    verify_pages()
