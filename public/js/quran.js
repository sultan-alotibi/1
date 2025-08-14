document.addEventListener('DOMContentLoaded', () => {
    const surahListContainer = document.getElementById('surah-list-container');
    const surahViewContainer = document.getElementById('surah-view-container');
    const surahList = document.getElementById('surah-list');
    const surahTitle = document.getElementById('surah-title');
    const ayahView = document.getElementById('ayah-view');
    const backButton = document.getElementById('back-to-surah-list');

    const API_BASE_URL = 'https://api.quran.com/api/v4';

    // Fetch and display all Surahs
    async function getSurahs() {
        try {
            const response = await fetch(`${API_BASE_URL}/chapters`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            displaySurahs(data.chapters);
        } catch (error) {
            console.error('Failed to fetch Surahs:', error);
            surahList.innerHTML = '<p>Failed to load Surahs. Please try again later.</p>';
        }
    }

    // Display Surahs on the homepage
    function displaySurahs(chapters) {
        surahList.innerHTML = ''; // Clear existing list
        chapters.forEach(chapter => {
            const card = document.createElement('div');
            card.className = 'surah-card';
            card.dataset.id = chapter.id;
            card.dataset.name = chapter.name_arabic;

            card.innerHTML = `
                <p class="surah-name-arabic">${chapter.name_arabic}</p>
                <p class="surah-name-translation">${chapter.name_simple} (${chapter.translated_name.name})</p>
                <p class="surah-info">${chapter.revelation_place} - ${chapter.verses_count} verses</p>
            `;

            card.addEventListener('click', () => {
                showSurahView(chapter.id, chapter.name_arabic);
            });

            surahList.appendChild(card);
        });
    }

    // Fetch and display verses for a specific Surah
    async function getVerses(chapterId) {
        try {
            const response = await fetch(`${API_BASE_URL}/quran/verses/uthmani?chapter_number=${chapterId}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data.verses;
        } catch (error) {
            console.error(`Failed to fetch verses for chapter ${chapterId}:`, error);
            return null;
        }
    }

    // Show the detailed Surah view
    async function showSurahView(chapterId, chapterName) {
        surahListContainer.style.display = 'none';
        surahViewContainer.style.display = 'block';
        surahTitle.textContent = chapterName;
        ayahView.innerHTML = '<p>Loading verses...</p>';

        const verses = await getVerses(chapterId);

        if (verses) {
            ayahView.innerHTML = '';
            verses.forEach(verse => {
                const ayahElement = document.createElement('div');
                ayahElement.className = 'ayah';
                ayahElement.innerHTML = `
                    <p>${verse.text_uthmani} <span>(${verse.verse_key})</span></p>
                `;
                ayahView.appendChild(ayahElement);
            });
        } else {
            ayahView.innerHTML = '<p>Failed to load verses. Please try again.</p>';
        }
    }

    // Show the main Surah list view
    function showSurahList() {
        surahViewContainer.style.display = 'none';
        surahListContainer.style.display = 'block';
    }

    // Event listener for the back button
    backButton.addEventListener('click', showSurahList);

    // Initial load
    getSurahs();
});
