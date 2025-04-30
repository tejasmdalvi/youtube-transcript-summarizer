const API_KEY = "ENTER YOUTUBE API KEY";

const videoContainer = document.getElementById("video-container");
const searchBox = document.getElementById("search-box");
const searchButton = document.getElementById("search-button");

let currentVideoId = null;
let videos = []; // Store fetched videos
let currentPage = 1;
const videosPerPage = 12;
//  fetch videos from YouTube API
async function fetchVideos(query = "latest tech 2025") {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${query}&key=${API_KEY}&type=video`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        videos = data.items || [];
        currentPage = 1;
        displayVideos();
    } catch (error) {
        console.error("Error fetching videos:", error);
    }
}

function displayVideos() {
    videoContainer.innerHTML = "";
    const start = (currentPage - 1) * videosPerPage;
    const end = start + videosPerPage;
    const videosToShow = videos.slice(start, end);

    videosToShow.forEach(video => {
        displayVideo(video);
    });

    renderPaginationControls();
}

//  pagination 
function renderPaginationControls() {
    let existingPagination = document.querySelector(".pagination-container");
    if (existingPagination) existingPagination.remove();

    const paginationContainer = document.createElement("div");
    paginationContainer.classList.add("pagination-container");
    paginationContainer.style.display = "flex";
    paginationContainer.style.justifyContent = "center";
    paginationContainer.style.marginTop = "15px";
    paginationContainer.style.paddingBottom="20px"

    if (currentPage > 1) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.onclick = () => {
            currentPage--;
            displayVideos();
        };
        paginationContainer.appendChild(prevButton);
    }

    if (currentPage * videosPerPage < videos.length) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.onclick = () => {
            currentPage++;
            displayVideos();
        };
        paginationContainer.appendChild(nextButton);
    }

    document.body.appendChild(paginationContainer);
}

//  video details 
function displayVideo(video) {
    const { videoId } = video.id;
    const { title, description, publishedAt, thumbnails } = video.snippet;
    const thumbnailUrl = thumbnails.high.url || thumbnails.default.url || thumbnails.medium.url;

    const videoElement = document.createElement("div");
    videoElement.classList.add("video");

    videoElement.innerHTML = `
        <img src="${thumbnailUrl}" alt="${title}" onerror="this.onerror=null; this.src='https://via.placeholder.com/320x180?text=No+Thumbnail'">
        <h3>${title}</h3>
        <p>${description.substring(0, 100)}...</p>
        <small>Published: ${new Date(publishedAt).toLocaleDateString()}</small>
        <button onclick="playVideo('${videoId}')">Play</button>
    `;

    videoContainer.appendChild(videoElement);
}


function playVideo(videoId) {
    currentVideoId = videoId;
    videoContainer.innerHTML = `
        <div id="video-player">
            <iframe width="1000px" height="660px" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&showinfo=0&modestbranding=1" 
                frameborder="0" allowfullscreen>
            </iframe>
            <div class="button-container">
                <button class="back-btn" onclick="goBack()">⬅ Back</button>
                <button class="generate-btn" onclick="generateSummary()">Generate Summary</button>
                <select id="language-select" onchange="translateSummary()">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                    <option value="gu">Gujarati</option> 
                    
                </select>
            </div>
            <div id="summary-display"></div>
        </div>
    `;
}
//go back 
function goBack() {
    displayVideos();
}




async function fetchEnglishTranscript(videoId) {
    if (!videoId) {
        console.error("No video ID provided for transcript fetching.");
        return null;
    }

    try {
        const response = await fetch("http://localhost:5000/fetch_transcript", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ video_input: videoId }), 
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error fetching transcript:", data.error);
            return null;
        }

        return data.transcript; 
    } catch (error) {
        console.error("Error fetching  transcript:", error);
        return null;
    }
}

// Function to fetch & summarize transcript

async function generateSummary() {
    if (!currentVideoId) {
        console.error("Error: No videoId provided.");
        return;
    }

    console.log("Fetching transcript for Video ID:", currentVideoId);

    const summaryDisplay = document.getElementById("summary-display");
    summaryDisplay.innerHTML = "<p>Generating summary, please wait...</p>";

    try {
        // Fetch transcript from backend
        const transcriptResponse = await fetch("http://localhost:5000/fetch_transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_input: currentVideoId }),
        });

        const transcriptData = await transcriptResponse.json();

        if (!transcriptResponse.ok || !transcriptData.transcript) {
            console.error("Error fetching transcript:", transcriptData.error);
            summaryDisplay.innerHTML = `<p>Error fetching transcript: ${transcriptData.error || "Unknown error"}</p>`;
            return;
        }

        console.log("Transcript received:", transcriptData.transcript);

        // Send transcript to Bard API
        const summaryResponse = await fetch("http://localhost:5000/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: transcriptData.transcript }),
        });

        const summaryData = await summaryResponse.json();

        if (summaryResponse.ok && summaryData.summary) {
            summaryDisplay.innerHTML = `<h2>Summary</h2><p>${summaryData.summary}</p>`;
            summaryDisplay.style.display = "block"; 
        } else {
            summaryDisplay.innerHTML = `<p>Error summarizing: ${summaryData.error || "Unknown error"}</p>`;
        }
    } catch (error) {
        console.error("Error generating summary:", error);
        summaryDisplay.innerHTML = "<p>Error generating summary.</p>";
    }
}

async function translateSummary() {
    const language = document.getElementById("language-select").value;
    const summaryElement = document.getElementById("summary-display");

    if (!summaryElement || !summaryElement.innerHTML.trim()) {
        console.error("No summary available to translate.");
        alert("Please generate a summary first before translating.");
        return;
    }

    // Extract only text
    const summaryText = summaryElement.querySelector("p")?.innerText.trim();

    if (!summaryText) {
        alert("Summary is empty, cannot translate.");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: summaryText, target_lang: language }),
        });

        const data = await response.json();
        console.log("Translation API Response:", data);  

        if (response.ok && data.translation) {
            summaryElement.innerHTML = `<h2>Translated Summary</h2><p>${data.translation}</p>`;
        } else {
            console.error("Translation error:", data.error || "Unknown error");
            alert("Translation failed. Please try again.");
        }
    } catch (error) {
        console.error("Error translating summary:", error);
        alert("An error occurred while translating.");
    }
}

//search 
searchButton.addEventListener("click", () => {
    const searchQuery = searchBox.value.trim();
    if (searchQuery) fetchVideos(searchQuery);
});

// Fetch initial video
fetchVideos();
