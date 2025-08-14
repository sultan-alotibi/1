from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Go to the homepage
        page.goto("http://localhost:3000")

        # Wait for the surah list to be populated
        # We'll wait for the card for "Al-Fatihah" to be visible
        fatiha_card = page.locator('.surah-card', has_text='Al-Fatihah').first
        expect(fatiha_card).to_be_visible(timeout=30000) # 30 seconds timeout for API call

        # Take a screenshot of the homepage
        page.screenshot(path="jules-scratch/verification/01_homepage.png")
        print("Screenshot of the homepage taken.")

        # Click on the card for Surah Al-Fatihah
        fatiha_card.click()

        # Wait for the ayah view to load
        # We'll wait for the first ayah to be visible
        first_ayah = page.locator('.ayah', has_text='بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ').first
        expect(first_ayah).to_be_visible(timeout=30000)

        # Take a screenshot of the Surah view
        page.screenshot(path="jules-scratch/verification/02_surah_view.png")
        print("Screenshot of the Surah view taken.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
